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

5007
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Physics.h"
%}

uses "EntitiesMP/Mod/PhysBase";

// Simple physical object for creating bodies with a specific shape
class CPhysBody : CPhysBase {
name      "PhysBase";
thumbnail "Thumbnails\\MovingBrush.tbn";
features  "HasName", "IsTargetable";

properties:
 1 CTString m_strName "Name" 'N' = "PhysBase",
 2 CTString m_strDescription = "",
 3 enum ECollisionShape m_eShape "Shape" = COLSH_BOX,
 4 enum EWorldSurfaceType m_eSurfaceType "Material" = SURFACE_STONE,

 // Next geometry entity for building complex shapes
 5 CEntityPointer m_penNextGeom "Next geom",

10 FLOAT m_fSize1 "Size X/W" = 1.0f,
11 FLOAT m_fSize2 "Size Y/H" = 1.0f,
12 FLOAT m_fSize3 "Size Z/L" = 1.0f,

20 FLOAT m_fMass "Mass" = 1.0f,
21 BOOL m_bGravityGunPickUp "Gravity gun can pick up" = TRUE,
22 FLOAT m_fTouchDamage "Touch damage" = 0.0f,
23 FLOAT m_fBlockDamage "Block damage" = 0.0f,
24 BOOL m_bSectorGravity "Affected by sector gravity" = TRUE,

components:
  1 model   MODEL_BOX      "Models\\Misc\\Box.mdl",
  2 model   MODEL_SPHERE   "Models\\Misc\\Sphere.mdl",
  3 model   MODEL_CYLINDER "Models\\Misc\\Cylinder.mdl",
  4 texture TEXTURE_EDITOR "ModelsMP\\Editor\\Debug_EntityStack.tex",

functions:
  BOOL IsTargetValid(SLONG slPropertyOffset, CEntity *penTarget) {
    if (slPropertyOffset == offsetof(CPhysBody, m_penNextGeom)) {
      return IsDerivedFromID(penTarget, CPhysBody_ClassID);
    }

    return CPhysBase::IsTargetValid(slPropertyOffset, penTarget);
  };

  // Memory used by the physics object
  SLONG GetUsedMemory(void) {
    SLONG slUsedMemory = sizeof(CPhysBody) - sizeof(CPhysBase) + CPhysBase::GetUsedMemory();
    slUsedMemory += m_strName.Length();
    slUsedMemory += m_strDescription.Length();

    return slUsedMemory;
  };

  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    CPhysBase::AdjustShadingParameters(vLightDirection, colLight, colAmbient);
    return FALSE; // No shadow
  };

  // Select default render type for the physics object
  virtual void InitPhysicsObject(void) {
    InitAsEditorModel();
    SetFlags(GetFlags() & ~ENF_SEETHROUGH);
    SetPhysicsFlags(EPF_BRUSH_MOVING | EPF_CUSTOMCOLLISION);
    SetCollisionFlags(ECF_PHYS_TESTPROJECTILES | ECF_PHYS_ISMODEL);
  };

  BOOL HandleEvent(const CEntityEvent &ee) {
    switch (ee.ee_slEvent) {
      // Physics simulation
      case EVENTCODE_EPhysicsStart: {
        ConnectGeoms();
      } break;

      case EVENTCODE_EPhysicsStop: {
      } break;
    }

    return CPhysBase::HandleEvent(ee);
  };

/****************************************************************/
/*                  Physics object properties                   */
/****************************************************************/

  // Get physics object material
  virtual INDEX GetPhysMaterial(void) const { return m_eSurfaceType; };

  // Get physical collision size and shape
  virtual ECollisionShape GetPhysCollision(FLOAT3D &vSize) const {
    switch (m_eShape) {
      case COLSH_SPHERE:   vSize = FLOAT3D(m_fSize1, m_fSize1, m_fSize1); break;
      case COLSH_CYLINDER: vSize = FLOAT3D(m_fSize2, m_fSize2, m_fSize3); break;
      case COLSH_CAPSULE:  vSize = FLOAT3D(m_fSize2, m_fSize2, m_fSize3); break;
      default:             vSize = FLOAT3D(m_fSize1, m_fSize2, m_fSize3); // COLSH_BOX by default
    }

    return m_eShape;
  };

  // Get physics object mass
  virtual FLOAT GetPhysMass(void) const { return m_fMass; };

  // Get physics touch damage
  virtual FLOAT GetPhysTouchDamage(const ETouch &eTouch) const { return m_fTouchDamage; };

  // Get physics block damage
  virtual FLOAT GetPhysBlockDamage(const EBlock &eBlock) const { return m_fBlockDamage; };

/****************************************************************/
/*                   Physics object creation                    */
/****************************************************************/

  // Connect with the next geom
  void ConnectGeoms(void) {
    if (m_penNextGeom == NULL) {
      return;
    }

    CPhysBody *penGeom = (CPhysBody *)&*m_penNextGeom;
    PhysObj().Connect(penGeom->PhysObj());
  };

  // Whether or not to apply sector gravity instead of global physics gravity
  virtual BOOL PhysicsUseSectorGravity(void) const {
    return m_bSectorGravity;
  };

  // Whether or not a gravity gun can pick up the object
  virtual BOOL CanGravityGunPickUp(void) const {
    // Only if it's dynamic and allowed
    return m_bPhysDynamic && m_bGravityGunPickUp;
  };

  // Called every tick while the engine physics are used
  virtual void PhysStepEngine(void) {
    // Stay still
    if (en_vCurrentTranslationAbsolute.Length() > 0
     || GetDesiredRotation().Length() > 0) {
      ForceFullStop();
    }
  };

procedures:
  InitGeom() {
    InitPhysicsObject();

    switch (m_eShape) {
      case COLSH_BOX:
        SetModel(MODEL_BOX);
        GetModelObject()->StretchModel(FLOAT3D(m_fSize1, m_fSize2, m_fSize3));
        break;

      case COLSH_CYLINDER:
        SetModel(MODEL_CYLINDER);
        GetModelObject()->StretchModel(FLOAT3D(m_fSize2, m_fSize2, m_fSize3));
        break;

      case COLSH_CAPSULE:
        SetModel(MODEL_CYLINDER);
        GetModelObject()->StretchModel(FLOAT3D(m_fSize2, m_fSize2, m_fSize3));
        break;

      default:
        SetModel(MODEL_SPHERE);
        GetModelObject()->StretchModel(FLOAT3D(m_fSize1, m_fSize1, m_fSize1));
        break;
    }

    SetModelMainTexture(TEXTURE_EDITOR);
    ModelChangeNotify();

    return;
  };

  Main() {
    jump InitGeom();
  };
};
