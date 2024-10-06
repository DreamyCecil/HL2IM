/* Copyright (c) 2002-2012 Croteam Ltd. 
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

2
%{
#include "StdH.h"
%}

uses "EntitiesMP/Mod/Base/MovableEntity";

class export CCecilMovableModelEntity : CCecilMovableEntity {
name      "MovableModelEntity";
thumbnail "";

properties:
  1 INDEX en_iCollisionBox = 0,   // current collision box for model entities
  2 INDEX en_iWantedCollisionBox = 0, // collision box to change to

components:

functions:
  void ChecksumForSync(ULONG &ulCRC, INDEX iExtensiveSyncCheck) {
    // [Cecil] Better sync stuff through the same methods
    reinterpret_cast<CMovableModelEntity *>(this)->CMovableModelEntity::ChecksumForSync(ulCRC, iExtensiveSyncCheck);
  };

  void DumpSync_t(CTStream &strm, INDEX iExtensiveSyncCheck) {
    // [Cecil] Better sync stuff through the same methods
    reinterpret_cast<CMovableModelEntity *>(this)->CMovableModelEntity::DumpSync_t(strm, iExtensiveSyncCheck);
  };

  // [Cecil] Pre-moving logic with an additional rotation direction variable (for EPF_ROTATETOPLANE)
  void PreMoving(FLOAT3D &vRotationDir) {
    // if collision box should be changed
    if (en_iCollisionBox != en_iWantedCollisionBox) {
      // change if possible
      ChangeCollisionBoxIndexNow(en_iWantedCollisionBox);
    }

    CCecilMovableEntity::PreMoving(vRotationDir);
  };

  // [Cecil] NOTE: This virtual function is now a wrapper for compatibility
  void PreMoving(void) {
    FLOAT3D vDummy;
    PreMoving(vDummy);
  };

  void DoMoving(void) {
    CCecilMovableEntity::DoMoving();
  };

  /* Get current collision box index for this entity. */
  INDEX GetCollisionBoxIndex(void)
  {
    return en_iCollisionBox;
  };

  BOOL CheckForCollisionNow(INDEX iNewCollisionBox, CEntity **ppenObstacle) {
    // [Cecil] Better manage collision boxes through the same methods
    return reinterpret_cast<CMovableModelEntity *>(this)->CMovableModelEntity::CheckForCollisionNow(iNewCollisionBox, ppenObstacle);
  };

  /* Change current collision box. */
  BOOL ChangeCollisionBoxIndexNow(INDEX iNewCollisionBox, CEntity **ppenObstacle) {
    // [Cecil] Better manage collision boxes through the same methods
    return reinterpret_cast<CMovableModelEntity *>(this)->CMovableModelEntity::ChangeCollisionBoxIndexNow(iNewCollisionBox, ppenObstacle);
  };

  /* Change current collision box. */
  BOOL ChangeCollisionBoxIndexNow(INDEX iNewCollisionBox) {
    CEntity *penDummy;
    return ChangeCollisionBoxIndexNow(iNewCollisionBox, &penDummy);
  };

  /* Force immediate changing of collision box. */
  void ForceCollisionBoxIndexChange(INDEX iNewCollisionBox)
  {
    // if this is ska model
    if(en_RenderType == CEntity::RT_SKAMODEL || en_RenderType == CEntity::RT_SKAEDITORMODEL) {
      if(GetModelInstance()!=NULL) {
        // change his colision box index
        GetModelInstance()->mi_iCurentBBox = iNewCollisionBox;
      }
    }
    // remember new collision box
    en_iCollisionBox = iNewCollisionBox;
    en_iWantedCollisionBox = iNewCollisionBox;

    // recalculate collision info
    ModelChangeNotify();
  };

  /* Change current collision box next time when possible. */
  void ChangeCollisionBoxIndexWhenPossible(INDEX iNewCollisionBox) {
    en_iWantedCollisionBox = iNewCollisionBox;
  };

  void Read_t(CTStream *istr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CMovableModelEntity *>(this)->CMovableModelEntity::Read_t(istr);
  };

  void Write_t(CTStream *ostr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CMovableModelEntity *>(this)->CMovableModelEntity::Write_t(ostr);
  };

  // returns bytes of memory used by this object
  SLONG GetUsedMemory(void) {
    return (sizeof(CCecilMovableModelEntity) - sizeof(CCecilMovableEntity) + CCecilMovableEntity::GetUsedMemory());
  };

procedures:
  Dummy() {};

  // wait here until scheduled animation starts
  WaitUntilScheduledAnimStarts()
  {
    ASSERT(en_RenderType == CEntity::RT_MODEL || en_RenderType == CEntity::RT_EDITORMODEL);
    FLOAT fToWait = GetModelObject()->ao_tmAnimStart-_pTimer->CurrentTick();
    if( fToWait>0)
    {
      autowait(fToWait+_pTimer->TickQuantum);
    }
    return EReturn();
  };
};
