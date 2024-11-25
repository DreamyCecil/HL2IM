/* Copyright (c) 2024 Dreamy Cecil
This program is free software; you can redistribute it and/or modify
it under the terms of version 2 of the GNU General Public License as published by
the Free Software Foundation


This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

5100
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Effects.h"
#include "EntitiesMP/Cecil/Physics.h"
#include "EntitiesMP/Mod/Sound3D.h"
#include "EntitiesMP/EnemyBase.h"

#include <Extras/XGizmo/Interfaces/Data.h>

// How long to wait before returning to the last valid physical position
static const TIME _tmOutOfBoundsLimit = 1.0f;
static const TIME _tmValidPosUpdateFrequency = 1.0f;

// Check if the entity is inside any sector
inline BOOL IsInsideAnySector(CEntity *pen) {
  {FOREACHSRCOFDST(pen->en_rdSectors, CBrushSector, bsc_rsEntities, pbsc)
    return TRUE;
  ENDFOR}

  return FALSE;
};

// Get density multiplier from a material type
inline FLOAT GetDensityMultiplier(INDEX iMaterial) {
  switch (iMaterial) {
    // Sand sinks slowly
    case SURFACE_SAND:
    case SURFACE_RED_SAND:
    case SURFACE_SNOW:
      return 1.1f;

    // Water is water
    case SURFACE_WATER:
      return 1.0f;

    // Grass floats slightly
    case SURFACE_GRASS:
    case SURFACE_GRASS_SLIDING:
    case SURFACE_GRASS_NOIMPACT:
      return 0.7f;

    // Stone sinks a bit
    case SURFACE_STONE:
    case SURFACE_STONE_NOSTEP:
    case SURFACE_STONE_HIGHSTAIRS:
    case SURFACE_CLIMBABLESLOPE:
    case SURFACE_STONE_NOIMPACT:
    case SURFACE_STONE_HIGHSTAIRS_NOIMPACT:
    case MATERIAL_CASES(TILES):
      return 2.0f;

    // Ice floats normally
    case SURFACE_ICE:
    case SURFACE_ICE_CLIMBABLESLOPE:
    case SURFACE_ICE_SLIDINGSLOPE:
    case SURFACE_ICE_LESSSLIDING:
    case SURFACE_ROLLERCOASTER:
    case SURFACE_ICE_SLIDINGSLOPE_NOIMPACT:
    case SURFACE_ROLLERCOASTER_NOIMPACT:
      return 0.6f;

    // Wood floats normally
    case SURFACE_WOOD:
    case SURFACE_WOOD_SLIDING:
    case SURFACE_WOOD_SLOPE:
      return 0.6f;

    // Molten rocks sink a bit
    case SURFACE_LAVA:
      return 2.0f;

    // Metal sinks significantly
    case MATERIAL_CASES(METAL):
    case MATERIAL_CASES(METAL_GRATE):
      return 5.0f;

    // Lighter kind of metal
    case MATERIAL_CASES(CHAINLINK):
    case MATERIAL_CASES(WEAPON):
      return 3.0f;

    // Glass sinks a bit
    case MATERIAL_CASES(GLASS):
      return 1.5f;

    // Plastic floats significantly
    case MATERIAL_CASES(PLASTIC):
      return 0.2f;
  }

  ASSERTALWAYS("Cannot determine density multiplier for some material type!");
  return 1.0f;
};

#define CECILSOUND_TAG 5100

// [Cecil] TEMP
extern INDEX ode_bRenderPosition;
extern INDEX ode_bDebugInfo;
extern void Particles_ColoredBox(const CPlacement3D &plCenter, const FLOAT3D &vSize, COLOR col);

namespace IPhysDebugInfo {
  static CPhysBase *_penPhys = NULL;

  static FLOAT3D _vFloatForce1(0, 0, 0);
  static FLOAT3D _vFloatForce2(0, 0, 0);

  inline void DrawOneAxis(CDrawPort *pdp, CAnyProjection3D &apr, const FLOAT3D &vAxis, const FLOAT3D &vForce, BOOL bAltColors)
  {
    if (vAxis == FLOAT3D(0, 0, 0)) return;

    const COLOR colLine = (bAltColors ? 0xFFFF00FF : 0x00FF00FF);
    const COLOR colMin = (bAltColors ? 0x00FFFFFF : 0x0000FFFF);
    const COLOR colMax = (bAltColors ? 0xFF00FFFF : 0xFF0000FF);

    const FLOAT3D vPhys = _penPhys->GetLerpedPhysPlacement().pl_PositionVector;
    FLOATmatrix3D mPhys;
    MakeRotationMatrix(mPhys, _penPhys->GetLerpedPhysPlacement().pl_OrientationAngle);

    const FLOAT3D vMin = vPhys - vAxis * mPhys;
    const FLOAT3D vMax = vPhys + vAxis * mPhys;

    FLOAT3D vEnd1, vEnd2, vForce1, vForce2;

    // Object ends
    apr->ProjectCoordinate(vMin, vEnd1);
    apr->ProjectCoordinate(vMax, vEnd2);
    vEnd1(2) = pdp->GetHeight() - vEnd1(2);
    vEnd2(2) = pdp->GetHeight() - vEnd2(2);

    if (vEnd1(3) < 0 && vEnd2(3) < 0) pdp->DrawLine(vEnd1(1), vEnd1(2), vEnd2(1), vEnd2(2), colLine);

    if (vEnd1(3) < 0) pdp->DrawPoint(vEnd1(1), vEnd1(2), colMin, 4);
    if (vEnd2(3) < 0) pdp->DrawPoint(vEnd2(1), vEnd2(2), colMax, 4);

    // Floating force vectors
    if (_penPhys->en_fImmersionFactor >= 1.0f) return;

    apr->ProjectCoordinate(vMin + vForce * 4.0f, vForce1);
    apr->ProjectCoordinate(vMax - vForce * 4.0f, vForce2);
    vForce1(2) = pdp->GetHeight() - vForce1(2);
    vForce2(2) = pdp->GetHeight() - vForce2(2);

    if (vEnd1(3) < 0 && vForce1(3) < 0) pdp->DrawLine(vEnd1(1), vEnd1(2), vForce1(1), vForce1(2), colMin);
    if (vEnd2(3) < 0 && vForce2(3) < 0) pdp->DrawLine(vEnd2(1), vEnd2(2), vForce2(1), vForce2(2), colMax);

    if (vForce1(3) < 0) pdp->DrawPoint(vForce1(1), vForce1(2), colMin, 8);
    if (vForce2(3) < 0) pdp->DrawPoint(vForce2(1), vForce2(2), colMax, 8);
  };

  void DrawInfo(CDrawPort *pdp, CAnyProjection3D &apr) {
    // No debug info or playing on some server
    if (!ode_bDebugInfo || (_pNetwork->IsNetworkEnabled() && !_pNetwork->IsServer())) {
      return;
    }

    // No physics object
    if (_penPhys == NULL || !_penPhys->PhysicsUsable()) return;

    // Draw any longest dimensions of the object
    DrawOneAxis(pdp, apr, _penPhys->m_vLongestAxis1, _vFloatForce1, FALSE);
    DrawOneAxis(pdp, apr, _penPhys->m_vLongestAxis2, _vFloatForce2, TRUE);

    // Display various info
    FLOAT3D vPhys;
    apr->ProjectCoordinate(_penPhys->GetLerpedPhysPlacement().pl_PositionVector, vPhys);
    if (vPhys(3) > 0) return;

    vPhys(2) = pdp->GetHeight() - vPhys(2);

    pdp->DrawPoint(vPhys(1), vPhys(2), 0x7F, 8);
    pdp->DrawPoint(vPhys(1), vPhys(2), 0xBBD1EBFF, 4);

    pdp->SetFont(_pfdConsoleFont);
    pdp->SetTextScaling(1.0f);
    pdp->SetTextAspect(1.0f);

    // Basic entity info and collision shape
    CTString strInfo(0, "ID:%u (%s)\n", _penPhys->en_ulID, _penPhys->GetClass()->ec_pdecDLLClass->dec_strName);

    FLOAT3D vSize;
    ECollisionShape eShape = _penPhys->GetPhysCollision(vSize);

    static const char *_strShapes[4] = { "Box", "Sphere", "Cylinder", "Capsule" };
    strInfo += CTString(0, " Collision: %g, %g, %g (%s)\n", vSize(1), vSize(2), vSize(3), _strShapes[eShape]);

    static const char *_strAxes[4] = { 0, "1x", "2y", "3z" };

    strInfo += " Longest  axes:";
    if (_penPhys->m_iLongest1 != -1) strInfo += CTString(0, "  %s", _strAxes[_penPhys->m_iLongest1]);
    if (_penPhys->m_iLongest2 != -1) strInfo += CTString(0, "  %s", _strAxes[_penPhys->m_iLongest2]);

    strInfo += "\n Shortest axes:";
    if (_penPhys->m_iShortest1 != -1) strInfo += CTString(0, "  %s", _strAxes[_penPhys->m_iShortest1]);
    if (_penPhys->m_iShortest2 != -1) strInfo += CTString(0, "  %s", _strAxes[_penPhys->m_iShortest2]);

    // Physics properties
    strInfo += CTString(0, "\n\n Material: %d (%s)\n Mass/friction: %g / %g\n Bounce/velocity: %g / %g\n",
      _penPhys->GetPhysMaterial(), EWorldSurfaceType_enum.NameForValue(_penPhys->GetPhysMaterial()),
      _penPhys->GetPhysMass(), _penPhys->GetPhysFriction(), _penPhys->GetPhysBounce(), _penPhys->GetPhysBounceVel());

    const CContentType &ctUp = _penPhys->GetWorld()->wo_actContentTypes[_penPhys->en_iUpContent];
    const CContentType &ctDn = _penPhys->GetWorld()->wo_actContentTypes[_penPhys->en_iDnContent];

    // Floating properties
    strInfo += CTString(0, "\nFloating between sectors\n Immersion: %.3f\n Up sector: %s\n Dn sector: %s\n",
      _penPhys->en_fImmersionFactor, ctUp.ct_strName, ctDn.ct_strName);

    const PIX pixW = pdp->GetTextWidth(strInfo);
    const PIX pixH = _pfdConsoleFont->GetHeight() * IData::CountChar(strInfo, '\n');

    pdp->Fill(vPhys(1) + 12, vPhys(2) + 12, pixW + 8, pixH + 8, 0x7F);
    pdp->PutText(strInfo, vPhys(1) + 16, vPhys(2) + 16, 0xBBD1EBFF);
  };
};
%}

// Events sent upon toggling the physics simulation
event EPhysicsStart {};
event EPhysicsStop {};

// Abstract base for physical objects with a specific shape
class CPhysBase : CCecilMovableModelEntity {
name      "PhysBase";
thumbnail "";
features  "AbstractBaseClass";

properties:
 1 BOOL m_bPhysEnabled "Phys enabled" = TRUE, // Use realistic physics
 2 BOOL m_bPhysDynamic "Phys dynamic body" = TRUE, // Create a dynamic body instead of a static geom
 3 FLOAT m_fPhysMass   "Phys mass multiplier" = 1.0f, // Multiply GetPhysMass() value

 5 FLOAT m_fPhysFriction  "Phys friction" = 1.0f, // Multiply GetPhysFriction() value
 6 FLOAT m_fPhysBounce    "Phys bounce" = 1.0f, // Multiply GetPhysBounce() value
 7 FLOAT m_fPhysBounceVel "Phys bounce velocity" = 1.0f, // Multiply GetPhysBounceVel() value

// Touching/blocking data
10 INDEX m_iTouchType = 0, // 1 - touched, 2 - blocked
11 FLOATplane3D m_plTouchPlane = FLOATplane3D(FLOAT3D(0, 1, 0), 0.0f), // Touched plane
12 FLOAT3D m_vTouchClipped = FLOAT3D(0, 0, 0), // Vector of the clipped line on touch
13 FLOAT3D m_vTouchHit = FLOAT3D(0, 0, 0), // Where the touch occurred

14 FLOAT m_tmPhysContactTick = -100.0f, // When the last physics contact occurred
15 FLOAT m_fPhysDeepestContact = -1.0f, // What length the deepest contact has been since that tick
16 CEntityPointer m_penPhysContactSound, // Currently playing contact sound

// Last valid position for restoration
20 FLOAT3D m_vValidPos = FLOAT3D(0, 0, 0),
21 FLOATmatrix3D m_mValidRot = FLOATmatrix3D(0),
22 FLOAT m_tmOutOfBounds = -100.0f,
23 FLOAT m_tmLastMovement = -100.0f,
24 BOOL m_bCreatedOOB = FALSE, // Don't do out-of-bounds checks for objects that are created out of bounds

// Generic destructivity properties
30 FLOAT m_fPhysHealth "Phys health" = -1.0f,
31 BOOL m_bPhysEnvDamage "Phys only environment damage" = FALSE,
32 CEntityPointer m_penPhysDeath "Phys death target",

// [Cecil] TEMP: Longest and shortest axes of object dimensions
200 INDEX m_iLongest1 = -1,
201 INDEX m_iLongest2 = -1,
202 INDEX m_iShortest1 = -1,
203 INDEX m_iShortest2 = -1,
204 FLOAT3D m_vLongestAxis1 = FLOAT3D(0, 0, 0),
205 FLOAT3D m_vLongestAxis2 = FLOAT3D(0, 0, 0),

{
  SPhysObject m_obj; // Actual physics object simulated by the external physics engine
  FLOAT3D m_vObjPos; // Physics object position before simulation update
  FLOATmatrix3D m_mObjRot; // Physics object rotation before simulation update

  // For synchronizing held object for the gravity gun
  CSyncedEntityPtr m_syncGravityGun;
}

components:
 1 class CLASS_SOUND3D "Classes\\Sound3D.ecl",

functions:
  // Constructor
  void CPhysBase(void) {
    PhysObj().SetOwner(this);
    m_vObjPos = FLOAT3D(0, 0, 0);
    m_mObjRot.Diagonal(1.0f);

    m_syncGravityGun.SetOwner(this);
  };

  // Wrappers for CMovableModelEntity
  void OnInitialize(const CEntityEvent &eeInput) {
    CCecilMovableModelEntity::OnInitialize(eeInput);

    // Update sectors around the entity for out-of-bounds detection
    if (en_rdSectors.IsEmpty()) {
      FindSectorsAroundEntity();
    }

    PhysOnInit();
  };

  void OnEnd(void) {
    PhysOnEnd();
    CCecilMovableModelEntity::OnEnd();
  };

  void Write_t(CTStream *ostr) {
    CCecilMovableModelEntity::Write_t(ostr);
    PhysWrite_t(ostr);
  };

  void Read_t(CTStream *istr) {
    CCecilMovableModelEntity::Read_t(istr);
    PhysRead_t(istr);
  };

  // Initialization
  virtual void PhysOnInit(void) {
    m_mValidRot.Diagonal(1.0f);
    CreateObject();
  };

  // Destructor
  virtual void PhysOnEnd(void) {
    PhysObj().Clear(TRUE);

    // [Cecil] TEMP
    if (IPhysDebugInfo::_penPhys == this) {
      IPhysDebugInfo::_penPhys = NULL;
    }
  };

  virtual void PhysWrite_t(CTStream *ostr) {
    // Write sync class
    WriteHeldObject(m_syncGravityGun, ostr);

    // Write physics extras
    if (IsPlayingGame()) {
      ostr->WriteID_t(CChunkID("PHYX"));
      *ostr << m_vObjPos;
      *ostr << m_mObjRot;
    }
  };

  virtual void PhysRead_t(CTStream *istr) {
    // Read sync class
    ReadHeldObject(m_syncGravityGun, istr, this);

    // Read physics extras
    if (istr->PeekID_t() == CChunkID("PHYX")) {
      istr->ExpectID_t(CChunkID("PHYX"));
      *istr >> m_vObjPos;
      *istr >> m_mObjRot;
    }
  };

  void PreMoving(void) {
    FLOAT3D vLastGravity = en_vGravityDir;
    CCecilMovableModelEntity::PreMoving();

    // Unfreeze objects if the gravity has changed
    if (PhysicsUseSectorGravity() && en_vGravityDir != vLastGravity) {
      PhysObj().Unfreeze();
    }
  };

/****************************************************************/
/*                        Physics object                        */
/****************************************************************/

  // Get physics object
  odeObject &PhysObj(void) {
    return *m_obj.pObj;
  };

  const odeObject &PhysObj(void) const {
    return *m_obj.pObj;
  };

  // Check if physics object is usable
  BOOL PhysicsUsable(void) const {
    return ODE_IsStarted() && PhysObj().IsCreated();
  };

  // Whether or not to apply sector gravity instead of global physics gravity
  virtual BOOL PhysicsUseSectorGravity(void) const {
    return TRUE;
  };

  // Whether or not a gravity gun can interact with the object
  virtual BOOL CanGravityGunInteract(CCecilPlayerEntity *penPlayer) const {
    return m_bPhysDynamic;
  };

  // Whether or not a gravity gun can pick up the object
  virtual BOOL CanGravityGunPickUp(void) const {
    return m_bPhysDynamic;
  };

  // Check if the object is close enough to any player
  BOOL IsPhysNearAnyPlayer(FLOAT fDistance) {
    for (INDEX i = 0; i < CEntity::GetMaxPlayers(); i++) {
      CEntity *pen = CEntity::GetPlayerEntity(i);

      if (pen == NULL || pen->GetFlags() & ENF_DELETED) {
        continue;
      }

      FLOAT3D vDiff = (pen->GetPlacement().pl_PositionVector - GetPlacement().pl_PositionVector);
      vDiff(2) = 0.0f;

      if (vDiff.Length() <= fDistance) {
        return TRUE;
      }
    }

    return FALSE;
  };

  // Check if realistic physics can be enabled at a distance
  BOOL CanEnablePhysicsAtDistance(void) {
    const FLOAT fDistance = DistanceForDisablingPhysics();
    return fDistance > 0.0f && IsPhysNearAnyPlayer(fDistance);
  };

  // Check if realistic physics can be disabled at a distance
  BOOL CanDisablePhysicsAtDistance(void) {
    const FLOAT fDistance = DistanceForDisablingPhysics();
    return fDistance > 0.0f && !IsPhysNearAnyPlayer(fDistance);
  };

  // Process physics object before the actual physics simulation
  void OnPhysStep(void) {
    // [Cecil] TEMP
    if (m_syncGravityGun.IsSynced()) {
      IPhysDebugInfo::_penPhys = this;
    }

    // Using engine physics
    if (!PhysicsUsable()) {
      PhysStepEngine();

      // Reenable physics in close proximity to any player
      if (CanEnablePhysicsAtDistance() && CreateObject()) {
        // Notify the object after it's created
        SendEvent(EPhysicsStart());
      }
      return;
    }

    // Reset information about standing on some entity, which is irrelevant during realistic physics
    en_penReference = NULL;
    en_pbpoStandOn = NULL;

    const FLOAT3D vLastPos = m_vObjPos;

    if (!m_bCreatedOOB) {
      // Keep updating out of bounds timer until the object goes outside all sectors
      if (IsInsideAnySector(this)) {
        m_tmOutOfBounds = _pTimer->CurrentTick();

      // Restore last valid position if fell outside the sectors for too long
      } else if (_pTimer->CurrentTick() - m_tmOutOfBounds >= _tmOutOfBoundsLimit) {
        PhysObj().SetPosition(m_vValidPos);
        PhysObj().SetMatrix(m_mValidRot);

        // Randomize movement to prevent it from falling the same way over and over
        const FLOAT3D vRnd = FLOAT3D(FRnd() - 0.5f, FRnd() - 0.5f, FRnd() - 0.5f) / _pTimer->TickQuantum;
        PhysObj().SetCurrentTranslation(vRnd * 0.2f);
        PhysObj().SetCurrentRotation(vRnd * 15.0f);

        ODE_ReportOutOfBounds("ID:%u went out of bounds at ^cff7f7f%s^C; restored to ^c7fff7f%s^C", en_ulID,
          ODE_PrintVectorForReport(vLastPos), ODE_PrintVectorForReport(m_vValidPos));
      }
    }

    // Remember current position
    m_vObjPos = PhysObj().GetPosition();
    m_mObjRot = PhysObj().GetMatrix();

    if (!m_bCreatedOOB) {
      // Keep track of when the last significant movement occurred (further than 0.2m in one tick)
      if ((m_vObjPos - vLastPos).Length() > 0.2f * _pTimer->TickQuantum) {
        m_tmLastMovement = _pTimer->CurrentTick();

      // Remember valid position if haven't moved much recently
      } else if (_pTimer->CurrentTick() - m_tmLastMovement >= _tmValidPosUpdateFrequency) {
        m_vValidPos = PhysObj().GetPosition();
        m_mValidRot = PhysObj().GetMatrix();
        m_tmLastMovement = _pTimer->CurrentTick() + _tmValidPosUpdateFrequency;
      }
    }

    // Disable physics far enough from every player
    if (CanDisablePhysicsAtDistance()) {
      if (DestroyObject(FALSE)) {
        // Notify the object after it's destroyed
        SendEvent(EPhysicsStop());
      }
      return;
    }

    if (PhysObj().IsFrozen()) {
      PhysStepFrozen();
      return;
    }

    // Continue with proper physics
    PhysStepRealistic();

    // Determine lengths of the longest axes from the center
    FLOAT3D vSize;
    GetPhysCollision(vSize);

    m_vLongestAxis1 = m_vLongestAxis2 = FLOAT3D(0, 0, 0);
    if (m_iLongest1 != -1) { m_vLongestAxis1(m_iLongest1) = vSize(m_iLongest1) * 0.5f; }
    if (m_iLongest2 != -1) { m_vLongestAxis2(m_iLongest2) = vSize(m_iLongest2) * 0.5f; }

    // Regular gravity acceleration multiplier
    FLOAT fAccMul = en_fGravityA / 30.0f; // 30 seems to be regular gravity acceleration in sectors

    const CContentType &ctUp = GetWorld()->wo_actContentTypes[en_iUpContent];
    const CContentType &ctDn = GetWorld()->wo_actContentTypes[en_iDnContent];

    // Mass isn't being considered here (multiplied by PhysObj().mass.mass) because it is assumed that the density always matches the object volume
    // E.g. a "metal" box of the same volume as the "sand" box is always heavier, as should be specified by the mass property (e.g. 5kg vs 1kg)
    const FLOAT fDensity = 1000.0f * GetDensityMultiplier(GetPhysMaterial());

    const FLOAT fBouyancy = Clamp(
      1 - (ctDn.ct_fDensity / fDensity) * (    en_fImmersionFactor)
        - (ctUp.ct_fDensity / fDensity) * (1 - en_fImmersionFactor), -1.0f, +1.0f
    );

    // [Cecil] TODO: Determine en_fImmersionFactor using the entire volume of the object instead of only its single longest axis
    // (or use all three and pick the longest one relative to the polygon plane between sectors) to make this code more reliable
    if (en_fImmersionFactor < 1.0f) {
      // Make physics object orient itself along the longest dimensions while floating on water
      if (m_iLongest1 != -1) {
        const FLOAT3D vSizeDir = (m_vLongestAxis1 * PhysObj().GetMatrix()).SafeNormalize();
        const FLOAT fFloatDir = (vSizeDir % en_vGravityDir);
        const FLOAT3D vGravForce = en_vGravityDir * fAccMul * fFloatDir * 0.2f;

        PhysObj().UpdateGravity(TRUE,  vGravForce, -m_vLongestAxis1);
        PhysObj().UpdateGravity(TRUE, -vGravForce,  m_vLongestAxis1);

        // [Cecil] TEMP
        if (IPhysDebugInfo::_penPhys == this) {
          IPhysDebugInfo::_vFloatForce1 = vGravForce;
        }
      }

      if (m_iLongest2 != -1) {
        const FLOAT3D vSizeDir = (m_vLongestAxis2 * PhysObj().GetMatrix()).SafeNormalize();
        const FLOAT fFloatDir = (vSizeDir % en_vGravityDir);
        const FLOAT3D vGravForce = en_vGravityDir * fAccMul * fFloatDir * 0.2f;

        PhysObj().UpdateGravity(TRUE,  vGravForce, -m_vLongestAxis2);
        PhysObj().UpdateGravity(TRUE, -vGravForce,  m_vLongestAxis2);

        // [Cecil] TEMP
        if (IPhysDebugInfo::_penPhys == this) {
          IPhysDebugInfo::_vFloatForce2 = vGravForce;
        }
      }
    }

    if (fBouyancy < 0) {
      // [Cecil] NOTE: I really don't like this "difference, dot product, random constants" formula for multiplying
      // fAccMul but it produces the best results I could achieve without making objects swiftly shoot out of water
      const FLOAT3D vDiffV = VerticalDiff(PhysObj().GetCurrentTranslation(), en_vGravityDir);
      const FLOAT fDiffDir = (vDiffV % -en_vGravityDir);

      const FLOAT fVerticalSpeedMul = (fDiffDir >= 0 ? 2.0f : 0.2f);
      const FLOAT fVerticalSpeedDamping = ClampDn(Abs(fDiffDir), 1.0f);
      fAccMul *= fVerticalSpeedMul * fBouyancy / fVerticalSpeedDamping;

    } else {
      fAccMul *= fBouyancy;
    }

    // Apply manual sector gravity only if the gravity vector deviates from -Y or the acceleration is multiplied too much
    const BOOL bManualGravity = PhysicsUseSectorGravity() && (en_vGravityDir(2) >= -0.99f || Abs(fAccMul - 1) > 0.02f);

    PhysObj().UpdateGravity(bManualGravity, en_vGravityDir * fAccMul);
  };

  // Called every tick while the engine physics are used
  virtual void PhysStepEngine(void) {
    NOTHING;
  };

  // Called every tick while the physics object is frozen
  virtual void PhysStepFrozen(void) {
    // Stay still
    if (en_vCurrentTranslationAbsolute.Length() > 0
     || GetDesiredRotation().Length() > 0) {
      ForceFullStop();
    }
  };

  // Called every tick while the realistic physics are used
  virtual void PhysStepRealistic(void) {
    NOTHING;
  };

/****************************************************************/
/*                  Physics object properties                   */
/****************************************************************/

  // Check whether realistic physics should be used
  virtual BOOL UseRealisticPhysics(void) const { return m_bPhysEnabled; };

  // Disable physics for objects further than this distance from any player (if greater than 0)
  virtual FLOAT DistanceForDisablingPhysics(void) const { return -1.0f; };

  // Get physics object material
  virtual INDEX GetPhysMaterial(void) const { return -1; };

  // Check if decals can be attached to the object
  virtual BOOL AreDecalsAllowed(void) const { return TRUE; };

  // Get physical collision size and shape
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    vSize = FLOAT3D(1, 1, 1);
    return COLSH_BOX;
  };

  // Get physics object offset from the entity
  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const { return FALSE; };

  // Get physics object mass
  virtual FLOAT GetPhysMass(void) const { return 1.0f; };

  // Get physics collision parameters
  virtual FLOAT GetPhysFriction(void) const { return 1.0f; };
  virtual FLOAT GetPhysBounce(void) const { return 0.1f; };
  virtual FLOAT GetPhysBounceVel(void) const { return 1.0f; };

  // Get physics touch damage
  virtual FLOAT GetPhysTouchDamage(const ETouch &eTouch) { return 0.0f; };

  // Get physics block damage
  virtual FLOAT GetPhysBlockDamage(const EBlock &eBlock) { return 0.0f; };

/****************************************************************/
/*                   Physics object creation                    */
/****************************************************************/

  // Create a new physical object
  BOOL CreateObject(void) {
    // Delete last object
    PhysObj().Clear(TRUE);

    // Add this object to the controller during the game
    if (IsPlayingGame()) {
      if (_penGlobalController != NULL && !_penGlobalController->IsPhysical(this)) {
        _penGlobalController->m_cPhysEntities.Add(PhysObj().nPhysOwner);
      }
    }

    // Simulation is off, not using realistic physics, or far enough from every player
    if (!ODE_IsStarted() || !UseRealisticPhysics() || CanDisablePhysicsAtDistance()) { return FALSE; }

    // Hidden (or destroyed, in brush's case)
    if (GetFlags() & ENF_HIDDEN) { return FALSE; }

    // Empty brush
    if (GetRenderType() == RT_BRUSH && IsEmptyBrush()) { return FALSE; }

    // Begin creating a new object
    CPlacement3D plOffset;

    if (GetPhysOffset(plOffset)) {
      plOffset.RelativeToAbsolute(GetPlacement());
    } else {
      plOffset = GetPlacement();
    }

    PhysObj().BeginShape(plOffset, GetPhysMass() * m_fPhysMass, (m_bPhysDynamic ? OBJF_BODY : 0));

    PhysObj().fFriction  = GetPhysFriction() * m_fPhysFriction;
    PhysObj().fBounce    = Clamp(GetPhysBounce() * m_fPhysBounce, 0.0f, 1.0f);
    PhysObj().fBounceVel = GetPhysBounceVel() * m_fPhysBounceVel;

    // Add geoms of a specific max size
    FLOAT3D vMaxSize;
    ECollisionShape eShape = GetPhysCollision(vMaxSize);

    // [Cecil] TEMP: Determine longest axes of the object and remember them
    m_iLongest1 = m_iLongest2 = m_iShortest1 = m_iShortest2 = -1;

    // All axes are equal in a sphere
    if (eShape != COLSH_SPHERE) {
      // Determine the first longest axis
      if (vMaxSize(3) >= vMaxSize(1) && vMaxSize(3) >= vMaxSize(2)) {
        m_iShortest1 = 1;
        m_iShortest2 = 2;
        m_iLongest1  = 3;

      } else if (vMaxSize(1) >= vMaxSize(2) && vMaxSize(1) >= vMaxSize(3)) {
        m_iLongest1  = 1;
        m_iShortest1 = 2;
        m_iShortest2 = 3;

      } else if (vMaxSize(2) >= vMaxSize(1) && vMaxSize(2) >= vMaxSize(3)) {
        m_iShortest1 = 1;
        m_iLongest1  = 2;
        m_iShortest2 = 3;
      }

      // Determine the second longest axis from the short ones

      // If it's at least 90% of the longest one
      if (vMaxSize(m_iShortest1) >= vMaxSize(m_iLongest1) * 0.9f) {
        m_iLongest2 = m_iShortest1;
        m_iShortest1 = -1;

      } else if (vMaxSize(m_iShortest2) >= vMaxSize(m_iLongest1) * 0.9f) {
        m_iLongest2 = m_iShortest2;
        m_iShortest2 = -1;

      // If it's at least 10% longer than the other short one
      } else if (vMaxSize(m_iShortest1) > vMaxSize(m_iShortest2) * 1.1f) {
        m_iLongest2 = m_iShortest1;
        m_iShortest1 = -1;

      } else if (vMaxSize(m_iShortest2) > vMaxSize(m_iShortest1) * 1.1f) {
        m_iLongest2 = m_iShortest2;
        m_iShortest2 = -1;
      }
    }

    AddPhysGeoms(eShape, vMaxSize);

    // Finish up the object
    PhysObj().EndShape();

    // Remember current position
    m_vObjPos = PhysObj().GetPosition();
    m_mObjRot = PhysObj().GetMatrix();

    // Remember valid position
    m_vValidPos = m_vObjPos;
    m_mValidRot = m_mObjRot;
    m_tmOutOfBounds = _pTimer->CurrentTick();
    m_tmLastMovement = _pTimer->CurrentTick();
    m_bCreatedOOB = !IsInsideAnySector(this);

    // Reset health
    SetHealth(m_fPhysHealth);
    return TRUE;
  };

  // Add physics object geometry
  virtual void AddPhysGeoms(ECollisionShape eShape, const FLOAT3D &vMaxSize) {
    // Default collision shapes around the entity
    switch (eShape) {
      case COLSH_BOX:      PhysObj().SetBox(odeVector(vMaxSize(1), vMaxSize(2), vMaxSize(3))); break;
      case COLSH_SPHERE:   PhysObj().SetSphere(vMaxSize(1)); break;
      case COLSH_CYLINDER: PhysObj().SetCylinder(vMaxSize(2), vMaxSize(3)); break;
      case COLSH_CAPSULE:  PhysObj().SetCapsule(vMaxSize(2), vMaxSize(3) - vMaxSize(2)); break;
      default: ASSERTALWAYS("Unknown collision shape for physics geoms!"); break;
    }
  };

  // Destory physics object
  BOOL DestroyObject(BOOL bEntityDestruction) {
    // Drop this object on entity destruction
    // [Cecil] TEMP: And also until the physics flags are fixed for the gravity gun
    GravityGunObjectDrop(m_syncGravityGun);

    if (!PhysicsUsable()) { return FALSE; }

    const FLOAT3D vCenter = PhysObj().GetPosition();
    PhysObj().Clear(bEntityDestruction);

    // Update other objects around it
    if (_penGlobalController != NULL) {
      FLOATaabbox3D box;

      if (GetRenderType() == RT_BRUSH) {
        GetSize(box);
        box.Expand(8.0f);
        box += GetPlacement().pl_PositionVector;

      } else {
        FLOAT3D vSize;
        GetPhysCollision(vSize);
        box = FLOATaabbox3D(vCenter, vSize.Length() * 5.0f);
      }

      _penGlobalController->UpdatePhysObjects(box);
    }

    return TRUE;
  };

/****************************************************************/
/*                Common physics object movement                */
/****************************************************************/
  BOOL CanDamagePhysObject(CEntity *penInflictor) const {
    // Health isn't set
    if (m_fPhysHealth < 0.0f) { return FALSE; }

    // Not environment-exclusive
    if (!m_bPhysEnvDamage) { return TRUE; }

    // Environment-exclusive means no enemies or players
    return !IsDerivedFromID(penInflictor, CEnemyBase_ClassID) && !IS_PLAYER(penInflictor);
  };

  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType, FLOAT fDamage, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    if (CanDamagePhysObject(penInflictor)) {
      CCecilMovableModelEntity::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);
    }

    PhysicsDamageImpact(dmtType, fDamage, vHitPoint, vDirection);
  };

  // Push physics object in the damage direction
  void PhysicsDamageImpact(DamageType dmtType, FLOAT fDamage, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    // Determine physical force depending on damage type
    FLOAT fForce = fDamage * 5.0f;

    switch (dmtType) {
      case DMT_CLOSERANGE: fForce = 10.0f; break;
      case DMT_DROWNING:   fForce = 0.0f; break;
      //case DMT_IMPACT:     fForce = fDamage; break;
      case DMT_BRUSH:      fForce = fDamage; break;
      case DMT_BURNING:    fForce = 10.0f; break;
      case DMT_ACID:       fForce = 10.0f; break;
      case DMT_TELEPORT:   fForce = 100.0f; break;
      case DMT_FREEZING:   fForce = 0.0f; break;
      case DMT_SPIKESTAB:  fForce = 0.0f; break;
      case DMT_ABYSS:      fForce = 0.0f; break;
      case DMT_HEAT:       fForce = 10.0f; break;
      case DMT_CHAINSAW:   fForce = 10.0f; break;
    }

    if (fForce > 0.01f) {
      if (PhysicsUsable()) {
        PhysObj().AddForce(vDirection, fForce, vHitPoint);
      } else {
        GiveImpulseTranslationAbsolute(vDirection * fForce * ONE_TICK);
      }
    }

    //CPrintF("'%s' - %.2f (force: %.2f)\n", DamageType_enum.NameForValue(dmtType), fDamage, fForce);
  };

  BOOL HandleEvent(const CEntityEvent &ee) {
    switch (ee.ee_slEvent) {
      // Send event on death once
      case EVENTCODE_EDeath: {
        const EDeath &eDeath = (const EDeath &)ee;
        SendToTarget(m_penPhysDeath, EET_TRIGGER, eDeath.eLastDamage.penInflictor);

        m_fPhysHealth = -1.0f;
        m_penPhysDeath = NULL;
      } break;

      // Damage on touch
      case EVENTCODE_ETouch: {
        const ETouch &eTouch = (const ETouch &)ee;
        const FLOAT fDamage = GetPhysTouchDamage(eTouch);

        if (fDamage > 0.0f) {
          FLOAT3D vHit = eTouch.penOther->GetPlacement().pl_PositionVector;
          InflictDirectDamage(eTouch.penOther, this, DMT_BRUSH, fDamage, vHit, (FLOAT3D &)eTouch.plCollision);
        }
      } return TRUE;

      // Damage on block
      case EVENTCODE_EBlock: {
        const EBlock &eBlock = (const EBlock &)ee;
        const FLOAT fDamage = GetPhysBlockDamage(eBlock);

        if (fDamage > 0.0f) {
          FLOAT3D vHit = eBlock.penOther->GetPlacement().pl_PositionVector;
          InflictDirectDamage(eBlock.penOther, this, DMT_BRUSH, fDamage, vHit, (FLOAT3D &)eBlock.plCollision);
        }
      } return TRUE;

      // Teleport physics object
      case EVENTCODE_ETeleport: {
        FLOAT3D vPos;
        FLOATmatrix3D mRot;
        CPlacement3D plOffset;

        if (GetPhysOffset(plOffset)) {
          plOffset.RelativeToAbsolute(GetPlacement());
          vPos = plOffset.pl_PositionVector;
          MakeRotationMatrix(mRot, plOffset.pl_OrientationAngle);

        } else {
          vPos = GetPlacement().pl_PositionVector;
          mRot = GetRotationMatrix();
        }

        PhysObj().SetPosition(vPos);
        PhysObj().SetMatrix(mRot);
        PhysObj().Unfreeze();

        // Reset current position
        m_vObjPos = vPos;
        m_mObjRot = mRot;

        // Remember valid position
        m_vValidPos = m_vObjPos;
        m_mValidRot = m_mObjRot;
        m_tmOutOfBounds = _pTimer->CurrentTick();
        m_tmLastMovement = _pTimer->CurrentTick();
        m_bCreatedOOB = !IsInsideAnySector(this);
      } return TRUE;

      // Gravity Gun actions
      case EVENTCODE_EGravityGunStart: {
        const EGravityGunStart &eStart = (const EGravityGunStart &)ee;
        GravityGunStart(this, eStart.penWeapons);
      } return TRUE;

      case EVENTCODE_EGravityGunStop: {
        const EGravityGunStop &eStop = (const EGravityGunStop &)ee;
        GravityGunStop(this, eStop.ulFlags);
      } return TRUE;

      case EVENTCODE_EGravityGunPush: {
        const EGravityGunPush &ePush = (const EGravityGunPush &)ee;
        GravityGunPush(this, ePush.vDir, ePush.vHit);
      } return TRUE;
    }

    return CCecilMovableModelEntity::HandleEvent(ee);
  };

  // Physics object callback to make the entity follow its movement
  void OnPhysicsMovement(void) {
    // [Cecil] TEMP: Delete entities with invalid physics object positions
    if (!PhysObj().IsValidPosition()) {
      ODE_ReportOutOfBounds("ID:%u  ^cff7f7f%s entity at %s has invalid physics position!^C Deleting entity...", en_ulID,
        GetClass()->ec_pdecDLLClass->dec_strName, ODE_PrintVectorForReport(GetPlacement().pl_PositionVector));

      Destroy();
      return;
    }

    CPlacement3D plSource;

    if (GetPhysOffset(plSource)) {
      plSource.RelativeToAbsolute(GetPlacement());
    } else {
      plSource = GetPlacement();
    }

    // Move to target
    const FLOAT3D &vSource = plSource.pl_PositionVector;
    const ANGLE3D &aSource = plSource.pl_OrientationAngle;

    // Get position
    FLOAT3D vTarget = PhysObj().GetPosition();
    ANGLE3D aTarget;
    DecomposeRotationMatrixNoSnap(aTarget, PhysObj().GetMatrix());

    // Set translation and rotation
    FLOAT3D vMove = (vTarget - vSource);
    ANGLE3D aRotate(0, 0, 0);

    for (INDEX i = 1; i <= 3; ++i) {
      aRotate(i) = NormalizeAngle(aTarget(i) - aSource(i));
    }

    // Start moving
    SetDesiredTranslation(vMove / ONE_TICK);
    SetDesiredRotation(aRotate / ONE_TICK);
  };

  // Physics object callback to make the entity react to physics contacts
  void OnPhysicsContact(const FLOAT3D &vHit, const FLOAT3D &vDir, FLOAT fSpeed) {
    // Static object
    if (!PhysicsUsable()) { return; }

    // Reset contact if the last one was some time ago
    if (_pTimer->CurrentTick() - m_tmPhysContactTick > 0.5f) {
      m_fPhysDeepestContact = -1.0f;
      m_tmPhysContactTick = _pTimer->CurrentTick();
    }

    // Process the current contact
    PhysOnImpact(vHit, vDir, fSpeed);

    // Remember the new depth if this contact is longer than the last
    if (fSpeed > m_fPhysDeepestContact) {
      m_fPhysDeepestContact = fSpeed;
    }
  };

  // Called on the strongest physical impact this tick
  virtual void PhysOnImpact(const FLOAT3D &vHit, const FLOAT3D &vDir, FLOAT fSpeed) {
    // Impact speed is too low
    if (fSpeed < 0.1f) { return; }

    // Play impact sound
    const BOOL bHardImpact = (fSpeed > 0.5f);

    CTFileName fnmSound = PhysImpactSound(bHardImpact);
    if (fnmSound == "") { return; }

    CPlacement3D plSound(vHit, ANGLE3D(0, 0, 0));
    
    // Play new contact sound
    if (m_penPhysContactSound == NULL || (m_penPhysContactSound->GetFlags() & ENF_DELETED)) {
      m_penPhysContactSound = CreateEntity(plSound, CLASS_SOUND3D);
      CCecilSound3D &enSound = (CCecilSound3D &)*m_penPhysContactSound;

      enSound.m_fnSound = fnmSound;
      enSound.m_iFlags = SOF_3D;
      enSound.m_iTag = (bHardImpact ? CECILSOUND_TAG : CECILSOUND_TAG - 1);
      enSound.SetParameters(64.0f, 2.0f, 1.0f, 1.0f);
      enSound.Initialize();

    // Replace current sound with a more impactful one
    } else if (fSpeed > m_fPhysDeepestContact) {
      CCecilSound3D &enSound = (CCecilSound3D &)*m_penPhysContactSound;

      // If not hard impact yet
      if (enSound.m_iTag != CECILSOUND_TAG) {
        enSound.m_fnSound = fnmSound;
        enSound.m_iTag = CECILSOUND_TAG;
        enSound.Play();
      }
    }
  };

  // Get sound for physics object impact on contact (empty string if no sound)
  virtual CTFileName PhysImpactSound(BOOL bHard) {
    return SurfacePhysSound(this, GetPhysMaterial(), bHard);
  };

  // React to being touched or blocked
  void ReactToTouch(void) {
    if (!PhysicsUsable() || m_iTouchType == 0) {
      return;
    }

    FLOAT3D vDir = -(FLOAT3D &)m_plTouchPlane;
    vDir.SafeNormalize();

    FLOAT3D vClipped = m_vTouchClipped;

    // Touching
    if (m_iTouchType == 1) {
      FLOAT fClippedLine = vClipped.Length() / ONE_TICK * 10.0f;

      PhysObj().AddForce(vDir, fClippedLine, m_vTouchHit);

      ODE_ReportCollision("ID:%u  ^cdf8f00Touch^r : clipped(%+.6f, %+.6f, %+.6f;  %+.6f)\n", en_ulID,
        vClipped(1), vClipped(2), vClipped(3), fClippedLine);

    // Blocking
    } else if (m_iTouchType == 2) {
      FLOAT fClippedLine = vClipped.Length() / ONE_TICK * 5.0f;

      // Stop physical movement and synchronize object position with the entity
      PhysObj().SetCurrentTranslation(FLOAT3D(0, 0, 0));
      PhysObj().SetPosition(GetPlacement().pl_PositionVector);
      //PhysObj().SetMatrix(GetRotationMatrix());

      PhysObj().AddForce(vDir, fClippedLine, m_vTouchHit);

      ODE_ReportCollision("ID:%u  ^cdf8f00Block^r : clipped(%+.6f, %+.6f, %+.6f;  %+.6f)\n", en_ulID,
        vClipped(1), vClipped(2), vClipped(3), fClippedLine);
    }

    // Reset touch state
    m_iTouchType = 0;
  };

  virtual void GetCollisionBoxParameters(INDEX iBox, FLOATaabbox3D &box, INDEX &iEquality) {
    // [Cecil] TEMP: This is not ideal because the collision can be setup before physics simulation is enabled
    /*if (!PhysicsUsable()) {
      CCecilMovableModelEntity::GetCollisionBoxParameters(iBox, box, iEquality);
      return;
    }*/

    // Centered box
    FLOAT3D vSize;
    GetPhysCollision(vSize);
    box = FLOATaabbox3D(vSize * -0.5f, vSize * +0.5f);

    // Additional offset
    CPlacement3D plOffset;

    if (GetPhysOffset(plOffset)) {
      box += plOffset.pl_PositionVector;
    }

    // Determine equality by finding two shortest axes
    if (vSize(2) < vSize(3) && vSize(1) < vSize(3)) {
      iEquality = HEIGHT_EQ_WIDTH;

    } else if (vSize(3) < vSize(2) && vSize(1) < vSize(2)) {
      iEquality = LENGTH_EQ_WIDTH;

    } else if (vSize(3) < vSize(1) && vSize(2) < vSize(1)) {
      iEquality = LENGTH_EQ_HEIGHT;

    // Determine equality by finding two longest axes (as backup)
    } else if (vSize(2) >= vSize(3) && vSize(1) >= vSize(3)) {
      iEquality = HEIGHT_EQ_WIDTH;

    } else if (vSize(3) >= vSize(2) && vSize(1) >= vSize(2)) {
      iEquality = LENGTH_EQ_WIDTH;

    } else if (vSize(3) >= vSize(1) && vSize(2) >= vSize(1)) {
      iEquality = LENGTH_EQ_HEIGHT;
    }

    // Multiply by about sqrt(2) to cover the size when boxes are rotated 45 degrees
    box.StretchByFactor(1.5f);
  };

  void RenderParticles(void) {
    // [Cecil] TEMP: Render boxes around physics objects
    if (ode_bRenderPosition && (!_pNetwork->IsNetworkEnabled() || _pNetwork->IsServer())) {
      FLOAT3D vSize;
      GetPhysCollision(vSize);
      vSize += FLOAT3D(1, 1, 1) * 0.01f;

      CPlacement3D plOffset, plEntity, plPhys;

      if (GetPhysOffset(plOffset)) {
        plEntity = plOffset;
        plEntity.RelativeToAbsolute(CCecilMovableModelEntity::GetLerpedPlacement());

        plPhys = plOffset;
        plPhys.RelativeToAbsolute(GetLerpedPhysPlacement());

      } else {
        plEntity = CCecilMovableModelEntity::GetLerpedPlacement();
        plPhys = GetLerpedPhysPlacement();
      }

      // Bright red when physics are disabled
      if (!PhysicsUsable()) {
        Particles_ColoredBox(plEntity, vSize, C_lRED|0x3F);

      // Entity position and then real physics object position
      } else if (PhysObj().IsFrozen()) {
        // Dark purple when disabled
        Particles_ColoredBox(plEntity, vSize, C_dRED|0x3F);
        Particles_ColoredBox(plPhys, vSize, C_dBLUE|0x3F);

      } else {
        // Yellow when enabled
        Particles_ColoredBox(plEntity, vSize, C_RED|0x3F);
        Particles_ColoredBox(plPhys, vSize, C_GREEN|0x3F);
      }
    }
  };

  // Get lerped placement of the real physics object
  CPlacement3D GetLerpedPhysPlacement(void) const {
    // Interpolate physics object placement between ticks
    CPlacement3D pl0, pl1, plResult;

    pl0.pl_PositionVector = m_vObjPos;
    DecomposeRotationMatrixNoSnap(pl0.pl_OrientationAngle, m_mObjRot);

    pl1.pl_PositionVector = PhysObj().GetPosition();
    DecomposeRotationMatrixNoSnap(pl1.pl_OrientationAngle, PhysObj().GetMatrix());

    FLOAT fRatio;

    if (IsPredictor()) {
      fRatio = _pTimer->GetLerpFactor();
    } else {
      fRatio = _pTimer->GetLerpFactor2();
    }

    plResult.Lerp(pl0, pl1, fRatio);
    return plResult;
  };

  // Retrieve actual physics object placement for rendering purposes
  virtual CPlacement3D GetLerpedPlacement(void) const {
    // Use entity placement if physics are unavailable or while the object is being held
    if (!PhysicsUsable() || m_syncGravityGun.IsSynced()) {
      return CCecilMovableModelEntity::GetLerpedPlacement();
    }

    CPlacement3D plOffset;

    if (GetPhysOffset(plOffset)) {
      plOffset.pl_PositionVector = -plOffset.pl_PositionVector;
      plOffset.pl_OrientationAngle = -plOffset.pl_OrientationAngle;
      plOffset.RelativeToAbsoluteSmooth(GetLerpedPhysPlacement());
      return plOffset;
    }

    return GetLerpedPhysPlacement();
  };

procedures:
  Dummy() {};
};
