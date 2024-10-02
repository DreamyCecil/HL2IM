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

/*
 * Player entity.
 */
4
%{
#include "StdH.h"
%}

uses "EntitiesMP/Mod/Base/MovableModelEntity";

class export CCecilPlayerEntity : CCecilMovableModelEntity {
name      "PlayerEntity";
thumbnail "";
features "AbstractBaseClass";
properties:
  1 FLOAT en_tmPing = 0.0f,    // ping value in seconds (determined by derived class and distributed by the engine)
{
  CPlayerCharacter en_pcCharacter;   // character of the player
  CPlacement3D en_plViewpoint;       // placement of view point relative to the entity
  CPlacement3D en_plLastViewpoint;   // last view point (used for lerping)
}
components:
functions:
  CTString GetPlayerName(void) {
    return en_pcCharacter.GetNameForPrinting();
  };

  const CTString &GetName(void) const {
    return en_pcCharacter.GetName();
  };

  /* Get index of this player in the game. */
  INDEX GetMyPlayerIndex(void)
  {
    CEntity *penMe = this;
    if (IsPredictor()) {
      penMe = GetPredicted();
    }
    for (INDEX iPlayer=0; iPlayer<GetMaxPlayers(); iPlayer++) {
      // if this is ME (this)
      if (GetPlayerEntity(iPlayer)==penMe) {
        return iPlayer;
      }
    }
    // must find my self
    return 15;  // if not found, still return a relatively logical value
  }

  void DoMoving(void) {
    CCecilMovableModelEntity::DoMoving();
  };

  /* Copy entity from another entity of same class. */
  void Copy(CEntity &enOther, ULONG ulFlags) {
    CCecilMovableModelEntity::Copy(enOther, ulFlags);

    CCecilPlayerEntity *ppenOther = (CCecilPlayerEntity *)(&enOther);
    en_pcCharacter = ppenOther->en_pcCharacter;
    en_plViewpoint = ppenOther->en_plViewpoint;
    en_plLastViewpoint = ppenOther->en_plLastViewpoint;
  };

  void Read_t(CTStream *istr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CPlayerEntity *>(this)->CPlayerEntity::Read_t(istr);
  };

  void Write_t(CTStream *ostr) {
    // [Cecil] Better serialize stuff through the same methods
    reinterpret_cast<CPlayerEntity *>(this)->CPlayerEntity::Write_t(ostr);
  };

  // Apply the action packet to the entity movement.
  virtual void ApplyAction(const CPlayerAction &pa, FLOAT tmLatency) {};
  // Called when player is disconnected
  virtual void Disconnect(void) {};
  // Called when player character is changed
  virtual void CharacterChanged(const CPlayerCharacter &pcNew) { en_pcCharacter = pcNew; };

  // provide info for GameSpy enumeration
  virtual void GetGameSpyPlayerInfo( INDEX iPlayer, CTString &strOut) { };

  void ChecksumForSync(ULONG &ulCRC, INDEX iExtensiveSyncCheck) {
    // [Cecil] Better sync stuff through the same methods
    reinterpret_cast<CPlayerEntity *>(this)->CPlayerEntity::ChecksumForSync(ulCRC, iExtensiveSyncCheck);
  };

  void DumpSync_t(CTStream &strm, INDEX iExtensiveSyncCheck) {
    // [Cecil] Better sync stuff through the same methods
    reinterpret_cast<CPlayerEntity *>(this)->CPlayerEntity::DumpSync_t(strm, iExtensiveSyncCheck);
  };

procedures:
  // must have at least one procedure per class
  Dummy() {};
};
