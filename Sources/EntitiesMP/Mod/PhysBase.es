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

#include "EntitiesMP/Cecil/Physics.h"

// How long to wait before returning to the last valid physical position
static const _tmOutOfBoundsLimit = 1.0f;
static const _tmValidPosUpdateFrequency = 1.0f;

// Check if the entity is inside any sector
inline BOOL IsInsideAnySector(CEntity *pen) {
  {FOREACHSRCOFDST(pen->en_rdSectors, CBrushSector, bsc_rsEntities, pbsc)
    return TRUE;
  ENDFOR}

  return FALSE;
};

// [Cecil] TEMP
extern INDEX ode_bRenderPosition;
extern void Particles_ColoredBox(const CPlacement3D &plCenter, const FLOAT3D &vSize, COLOR col);
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
 1 BOOL m_bPhysEnabled "Physics enabled" = TRUE, // Use realistic physics
 2 BOOL m_bPhysDynamic "Physics dynamic body" = TRUE, // Create a dynamic body instead of a static geom
 3 FLOAT m_fPhysMass   "Physics mass multiplier" = 1.0f, // Multiply GetPhysMass() value

 5 FLOAT m_fPhysFriction  "Physics friction" = 1.0f, // Multiply GetPhysFriction() value
 6 FLOAT m_fPhysBounce    "Physics bounce" = 1.0f, // Multiply GetPhysBounce() value
 7 FLOAT m_fPhysBounceVel "Physics bounce velocity" = 1.0f, // Multiply GetPhysBounceVel() value

// Touching/blocking data
10 INDEX m_iTouchType = 0, // 1 - touched, 2 - blocked
11 FLOATplane3D m_plTouchPlane = FLOATplane3D(FLOAT3D(0, 1, 0), 0.0f), // Touched plane
12 FLOAT3D m_vTouchClipped = FLOAT3D(0, 0, 0), // Vector of the clipped line on touch
13 FLOAT3D m_vTouchHit = FLOAT3D(0, 0, 0), // Where the touch occurred

// Last valid position for restoration
20 FLOAT3D m_vValidPos = FLOAT3D(0, 0, 0),
21 FLOATmatrix3D m_mValidRot = FLOATmatrix3D(0),
22 FLOAT m_tmOutOfBounds = -100.0f,
23 FLOAT m_tmLastMovement = -100.0f,
24 BOOL m_bCreatedOOB = FALSE, // Don't do out-of-bounds checks for objects that are created out of bounds

{
  SPhysObject m_obj; // Actual physics object simulated by the external physics engine
  FLOAT3D m_vObjPos; // Physics object position before simulation update
  FLOATmatrix3D m_mObjRot; // Physics object rotation before simulation update

  // For synchronizing held object for the gravity gun
  CSyncedEntityPtr m_syncGravityGun;
}

components:

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

  // Process physics object before the actual physics simulation
  void OnPhysStep(void) {
    AddToMovers();

    // Using engine physics
    if (!PhysicsUsable()) {
      PhysStepEngine();
      return;
    }

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

    if (PhysObj().IsFrozen()) {
      PhysStepFrozen();
      return;
    }

    // Continue with proper physics
    PhysStepRealistic();

    // Apply manual sector gravity only if the gravity vector deviates from -Y or the acceleration is multiplied too much
    const FLOAT fAccMul = en_fGravityA / 30.0f; // 30 seems to be regular gravity acceleration in sectors
    const BOOL bManualGravity = PhysicsUseSectorGravity() && (en_vGravityDir(2) >= -0.99f || Abs(fAccMul - 1) > 0.02f);

    PhysObj().UpdateGravity(bManualGravity, en_vGravityDir, fAccMul);
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
  virtual FLOAT GetPhysTouchDamage(const ETouch &eTouch) const { return 0.0f; };

  // Get physics block damage
  virtual FLOAT GetPhysBlockDamage(const EBlock &eBlock) const { return 0.0f; };

/****************************************************************/
/*                   Physics object creation                    */
/****************************************************************/

  // Create a new physical object
  void CreateObject(void) {
    // Delete last object
    PhysObj().Clear(TRUE);

    if (!ODE_IsStarted() || !UseRealisticPhysics()) { return; }

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

    // Add this object to the controller
    _penGlobalController->m_cPhysEntities.Add(PhysObj().nPhysOwner);
  };

  // Add physics object geometry
  virtual void AddPhysGeoms(ECollisionShape eShape, const FLOAT3D &vMaxSize) {
    // Default collision shapes around the entity
    switch (eShape) {
      case COLSH_BOX:      PhysObj().AddBox(odeVector(vMaxSize(1), vMaxSize(2), vMaxSize(3))); break;
      case COLSH_SPHERE:   PhysObj().AddSphere(vMaxSize(1)); break;
      case COLSH_CYLINDER: PhysObj().AddCylinder(vMaxSize(2), vMaxSize(3)); break;
      case COLSH_CAPSULE:  PhysObj().AddCapsule(vMaxSize(2), vMaxSize(3) - vMaxSize(2)); break;
      default: ASSERTALWAYS("Unknown collision shape for physics geoms!"); break;
    }
  };

/****************************************************************/
/*                Common physics object movement                */
/****************************************************************/

  void ReceiveDamage(CEntity *penInflictor, enum DamageType dmtType, FLOAT fDamage, const FLOAT3D &vHitPoint, const FLOAT3D &vDirection) {
    CCecilMovableModelEntity::ReceiveDamage(penInflictor, dmtType, fDamage, vHitPoint, vDirection);

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

  // Update movement according to the physical object
  void UpdateMovement(void) {
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
        plPhys.RelativeToAbsolute(GetLerpedPlacement());

      } else {
        plEntity = CCecilMovableModelEntity::GetLerpedPlacement();
        plPhys = GetLerpedPlacement();
      }

      Particles_ColoredBox(plEntity, vSize, C_RED|0x3F); // Entity position
      Particles_ColoredBox(plPhys, vSize, C_GREEN|0x3F); // Real physics object position
    }
  };

  // Retrieve actual physics object placement for rendering purposes
  virtual CPlacement3D GetLerpedPlacement(void) const {
    // Use entity placement if physics are unavailable or while the object is being held
    if (!PhysicsUsable() || m_syncGravityGun.IsSynced()) {
      return CCecilMovableModelEntity::GetLerpedPlacement();
    }

    // Interpolate physics object placement between ticks using quaternions
    FLOAT3D v0 = m_vObjPos;
    FLOATquat3D q0;
    q0.FromMatrix(const_cast<FLOATmatrix3D &>(m_mObjRot));

    FLOAT3D v1 = PhysObj().GetPosition();
    FLOATquat3D q1;
    q1.FromMatrix(const_cast<FLOATmatrix3D &>(PhysObj().GetMatrix()));

    FLOAT fRatio;

    if (IsPredictor()) {
      fRatio = _pTimer->GetLerpFactor();
    } else {
      fRatio = _pTimer->GetLerpFactor2();
    }

    CPlacement3D plResult;
    plResult.pl_PositionVector = Lerp(v0, v1, fRatio);

    FLOATquat3D qResult = Slerp(fRatio, q0, q1);
    FLOATmatrix3D mResult;
    qResult.ToMatrix(mResult);

    DecomposeRotationMatrixNoSnap(plResult.pl_OrientationAngle, mResult);

    CPlacement3D plOffset;

    if (GetPhysOffset(plOffset)) {
      plOffset.pl_PositionVector = -plOffset.pl_PositionVector;
      plOffset.pl_OrientationAngle = -plOffset.pl_OrientationAngle;
      plOffset.RelativeToAbsoluteSmooth(plResult);
      return plOffset;
    }

    return plResult;
  };

procedures:
  Dummy() {};
};
