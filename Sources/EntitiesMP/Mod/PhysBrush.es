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

5005
%{
#include "StdH.h"

#include "EntitiesMP/Cecil/Physics.h"
%}

uses "EntitiesMP/Mod/PhysBody";

// Entity for defining a physical object as a brush
class CPhysBrush : CPhysBody {
name      "PhysBrush";
thumbnail "Thumbnails\\MovingBrush.tbn";
features  "HasName", "IsTargetable";

properties:
10 BOOL m_bDynamicShadows "Dynamic shadows" = FALSE,

20 flags ClasificationBits m_cbClassificationBits "Clasification bits" 'C' = 0,
21 flags VisibilityBits m_vbVisibilityBits "Visibility bits" 'V' = 0,

components:

functions:
  // Strip all CMovableModelEntity functionality to emulate CMovableBrushEntity
  void ChecksumForSync(ULONG &ulCRC, INDEX iExtensiveSyncCheck) { CCecilMovableEntity::ChecksumForSync(ulCRC, iExtensiveSyncCheck); };
  void DumpSync_t(CTStream &strm, INDEX iExtensiveSyncCheck) { CCecilMovableEntity::DumpSync_t(strm, iExtensiveSyncCheck); };

  void PreMoving(void) {
    // Do field checking for brushes (for gravity vector calculation)
    FLOAT3D vLastGravity = en_vGravityDir;
    TestFields(en_iUpContent, en_iDnContent, en_fImmersionFactor, TRUE);

    // Unfreeze objects if the gravity has changed
    if (PhysicsUseSectorGravity() && en_vGravityDir != vLastGravity) {
      PhysObj().Unfreeze();
    }

    CCecilMovableEntity::PreMoving();
  };

  void DoMoving(void) { CCecilMovableEntity::DoMoving(); };
  void PostMoving(void) { CCecilMovableEntity::PostMoving(); };

  INDEX GetCollisionBoxIndex(void) { return CCecilMovableEntity::GetCollisionBoxIndex(); };

  // Don't use these CMovableModelEntity methods
  BOOL CheckForCollisionNow(INDEX i, CEntity **ppen)       { ASSERT(FALSE); return FALSE; };
  BOOL ChangeCollisionBoxIndexNow(INDEX i, CEntity **ppen) { ASSERT(FALSE); return FALSE; };
  BOOL ChangeCollisionBoxIndexNow(INDEX i)                 { ASSERT(FALSE); return FALSE; };
  void ForceCollisionBoxIndexChange(INDEX i)               { ASSERT(FALSE); };
  void ChangeCollisionBoxIndexWhenPossible(INDEX i)        { ASSERT(FALSE); };

  // CPhysGeometry overrides
  SLONG GetUsedMemory(void) {
    // Emulate CMovableBrushEntity
    SLONG slUsedMemory = sizeof(CPhysBrush) - sizeof(CCecilMovableEntity) + CCecilMovableEntity::GetUsedMemory();
    slUsedMemory += m_strName.Length();
    slUsedMemory += m_strDescription.Length();

    return slUsedMemory;
  };

  BOOL AdjustShadingParameters(FLOAT3D &vLightDirection, COLOR &colLight, COLOR &colAmbient) {
    // Emulate CMovableBrushEntity
    return CCecilMovableEntity::AdjustShadingParameters(vLightDirection, colLight, colAmbient);
  };

  // Wrappers for CMovableBrushEntity
  void OnInitialize(const CEntityEvent &eeInput) {
    CCecilMovableEntity::OnInitialize(eeInput);
    PhysOnInit();
  };

  void OnEnd(void) {
    PhysOnEnd();
    CCecilMovableEntity::OnEnd();
  };

  void Write_t(CTStream *ostr) {
    CCecilMovableEntity::Write_t(ostr);
    PhysWrite_t(ostr);
  };

  void Read_t(CTStream *istr) {
    CCecilMovableEntity::Read_t(istr);
    PhysRead_t(istr);
  };

  // Get visibility tweaking bits
  ULONG GetVisTweaks(void) {
    return m_cbClassificationBits | m_vbVisibilityBits;
  };

  // Select default render type for the physics object
  virtual void InitPhysicsObject(void) {
    InitAsBrush();
    SetPhysicsFlags(EPF_BRUSH_MOVING | EPF_CUSTOMCOLLISION);
    SetCollisionFlags(ECF_PHYS_TESTALL | ECF_PHYS_ISBRUSH);
  };

procedures:
  Main() {
    InitPhysicsObject();
    SetHealth(-1.0f);

    // Set dynamic shadows as needed
    if (m_bDynamicShadows) {
      SetFlags(GetFlags() | ENF_DYNAMICSHADOWS);
    } else {
      SetFlags(GetFlags() & ~ENF_DYNAMICSHADOWS);
    }

    return;
  };
};
