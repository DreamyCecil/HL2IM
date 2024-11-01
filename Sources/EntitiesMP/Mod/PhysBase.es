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
#include <Engine/Math/OBBox.h>

// [Cecil] TEMP
extern INDEX ode_bRenderPosition;
extern void Particles_ColoredBox(const CPlacement3D &plCenter, const FLOAT3D &vSize, COLOR col);
%}

// Abstract base for physical objects with a specific shape
class CPhysBase : CCecilMovableModelEntity {
name      "PhysBase";
thumbnail "";
features  "AbstractBaseClass";

properties:
// Touching/blocking data
10 INDEX m_iTouchType = 0, // 1 - touched, 2 - blocked
11 FLOATplane3D m_plTouchPlane = FLOATplane3D(FLOAT3D(0, 1, 0), 0.0f), // Touched plane
12 FLOAT3D m_vTouchClipped = FLOAT3D(0, 0, 0), // Vector of the clipped line on touch
13 FLOAT3D m_vTouchHit = FLOAT3D(0, 0, 0), // Where the touch occurred

{
  SPhysObject m_obj; // Actual physics object simulated by the external physics engine
  FLOAT3D m_vObjPos; // Physics object position before simulation update
  FLOATmatrix3D m_mObjRot; // Physics object rotation before simulation update

  // For adding to global controller that will run the step function
  CEntityNode m_nNode;

  // For synchronizing held object for the gravity gun
  CSyncedEntityPtr m_syncGravityGun;
}

components:

functions:
  // Constructor
  void CPhysBase(void) {
    PhysObj().penPhysOwner = this;
    m_vObjPos = FLOAT3D(0, 0, 0);
    m_mObjRot.Diagonal(1.0f);

    m_nNode.SetOwner(this);
    m_syncGravityGun.SetOwner(this);
  };

  void OnInitialize(const CEntityEvent &eeInput) {
    CCecilMovableModelEntity::OnInitialize(eeInput);
    CreateObject();
  };

  // Wrappers for CMovableModelEntity
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

  // Destructor
  virtual void PhysOnEnd(void) {
    PhysObj().Clear();
    m_nNode.Remove();
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

  // Entity physics flags to set whenever physics are toggled
  virtual ULONG PhysicsFlagsForPhysSimulation(BOOL bEnabled) const {
    if (bEnabled) {
      // Disable engine physics
      return GetPhysicsFlags() & ~(EPF_TRANSLATEDBYGRAVITY | EPF_ORIENTEDBYGRAVITY);
    }

    // Enable engine physics
    return GetPhysicsFlags() | EPF_TRANSLATEDBYGRAVITY | EPF_ORIENTEDBYGRAVITY;
  };

  // Entity collision flags to set whenever physics are toggled
  virtual ULONG CollisionFlagsForPhysSimulation(BOOL bEnabled) const {
    // Ignore
    return 0;
  };

  // Whether or not to apply sector gravity instead of global physics gravity
  virtual BOOL PhysicsUseSectorGravity(void) const {
    return TRUE;
  };

  // Process physics object before the actual physics simulation
  virtual void OnPhysStep(void) {
    AddToMovers();
    ULONG ulFlags;

    // Apply regular engine physics if it's unusable
    if (!PhysicsUsable()) {
      ulFlags = PhysicsFlagsForPhysSimulation(FALSE);

      if (ulFlags != 0) {
        SetPhysicsFlags(ulFlags);
      }

      ulFlags = CollisionFlagsForPhysSimulation(FALSE);

      if (ulFlags != 0) {
        SetCollisionFlags(ulFlags);
      }

      return;
    }

    // Remember current position
    m_vObjPos = PhysObj().GetPosition();
    m_mObjRot = PhysObj().GetMatrix();

    ulFlags = PhysicsFlagsForPhysSimulation(TRUE);

    if (ulFlags != 0 && GetPhysicsFlags() != ulFlags) {
      SetPhysicsFlags(ulFlags);
    }

    ulFlags = CollisionFlagsForPhysSimulation(TRUE);

    if (ulFlags != 0 && GetCollisionFlags() != ulFlags) {
      SetCollisionFlags(ulFlags);
    }

    // Stay still if it's frozen
    if (PhysObj().IsFrozen()) {
      if (en_vCurrentTranslationAbsolute.Length() > 0
       || en_aCurrentRotationAbsolute.Length() > 0) {
        ForceFullStop();
      }

      return;
    }

    // Continue with proper physics

    // Apply manual sector gravity only if the gravity vector deviates from -Y too much
    const BOOL bManualGravity = (PhysicsUseSectorGravity() && en_vGravityDir(2) >= -0.99f);
    PhysObj().UpdateGravity(bManualGravity, en_vGravityDir);
  };

/****************************************************************/
/*                  Physics object properties                   */
/****************************************************************/

  // Get physics object material
  virtual INDEX GetPhysMaterial(void) const { return -1; };

  // Get physical collision size and shape
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    vSize = FLOAT3D(1, 1, 1);
    return COLSH_BOX;
  };

  // Get physics object offset from the entity
  virtual BOOL GetPhysOffset(CPlacement3D &plOffset) const { return FALSE; };

  // Get physics object mass
  virtual FLOAT GetPhysMass(void) const { return 1.0f; };

  // Check if the physics object is actually affected by physics instead of staying static
  virtual BOOL IsPhysDynamic(void) const { return TRUE; };

  // Get physics touch damage
  virtual FLOAT GetPhysTouchDamage(void) const { return 0.0f; };

  // Get physics block damage
  virtual FLOAT GetPhysBlockDamage(void) const { return 0.0f; };

/****************************************************************/
/*                   Physics object creation                    */
/****************************************************************/

  // Create a new physical object
  void CreateObject(void) {
    // Delete last object
    PhysObj().Clear();

    if (!ODE_IsStarted()) {
      return;
    }

    // Add this object to the controller
    _penGlobalController->m_cPhysStep.Add(m_nNode);

    // Begin creating a new object
    CPlacement3D plOffset;

    if (GetPhysOffset(plOffset)) {
      plOffset.RelativeToAbsolute(GetPlacement());
      PhysObj().BeginShape(plOffset, GetPhysMass(), IsPhysDynamic());

    } else {
      PhysObj().BeginShape(GetPlacement(), GetPhysMass(), IsPhysDynamic());
    }

    // Add geoms of a specific max size
    FLOAT3D vMaxSize;
    ECollisionShape eShape = GetPhysCollision(vMaxSize);
    AddPhysGeoms(eShape, vMaxSize);

    // Finish up the object
    PhysObj().EndShape();
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

  // Connect with other geoms, if possible
  virtual void ConnectGeoms(void) {};

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

    if (PhysicsUsable() && fForce > 0.01f) {
      PhysObj().AddForce(vDirection, fForce, vHitPoint);
    } else {
      GiveImpulseTranslationAbsolute(vDirection * fForce);
    }

    //CPrintF("'%s' - %.2f (force: %.2f)\n", DamageType_enum.NameForValue(dmtType), fDamage, fForce);
  };

  BOOL HandleEvent(const CEntityEvent &ee) {
    switch (ee.ee_slEvent) {
      // Damage on touch
      case EVENTCODE_ETouch: {
        const ETouch &eTouch = (const ETouch &)ee;
        const FLOAT fDamage = GetPhysTouchDamage();

        if (fDamage > 0.0f) {
          FLOAT3D vHit = eTouch.penOther->GetPlacement().pl_PositionVector;
          InflictDirectDamage(eTouch.penOther, this, DMT_BRUSH, fDamage, vHit, (FLOAT3D &)eTouch.plCollision);
        }
      } return TRUE;

      // Damage on block
      case EVENTCODE_EBlock: {
        const EBlock &eBlock = (const EBlock &)ee;
        const FLOAT fDamage = GetPhysBlockDamage();

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
    FLOAT3D m_vDesiredPos = PhysObj().GetPosition();
    ANGLE3D m_aDesiredRot;
    DecomposeRotationMatrixNoSnap(m_aDesiredRot, PhysObj().GetMatrix());

    // Set translation and rotation
    CPlacement3D m_plMovement;
    m_plMovement.pl_PositionVector = (m_vDesiredPos - vSource);

    for (INDEX i = 1; i <= 3; ++i) {
      m_plMovement.pl_OrientationAngle(i) = NormalizeAngle(m_aDesiredRot(i) - aSource(i));
    }

    // Start moving
    SetDesiredTranslation(m_plMovement.pl_PositionVector / ONE_TICK);
    SetDesiredRotation(m_plMovement.pl_OrientationAngle / ONE_TICK);
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

    DecomposeRotationMatrix(plResult.pl_OrientationAngle, mResult);

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
