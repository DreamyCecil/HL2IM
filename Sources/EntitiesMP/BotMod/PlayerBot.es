/* Copyright (c) 2018-2021 Dreamy Cecil
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

410
%{
#include "StdH.h"

#include "Bots/BotFunctions.h"
#include "Bots/BotMovement.h"

#define THOUGHT(_String) (m_btThoughts.Push(_String))
%}

uses "EntitiesMP/Player";
uses "EntitiesMP/PlayerWeapons";

uses "EntitiesMP/AmmoItem";
uses "EntitiesMP/AmmoPack";
uses "EntitiesMP/ArmorItem";
uses "EntitiesMP/HealthItem";
uses "EntitiesMP/Item";
uses "EntitiesMP/PowerUpItem";
uses "EntitiesMP/WeaponItem";

// [Cecil] Player bot
class CPlayerBot : CPlayer {
name      "PlayerBot";
thumbnail "";

properties:
  1 CEntityPointer m_penTarget, // shooting target
  2 CEntityPointer m_penFollow, // following target
  3 FLOAT m_tmLastBotTarget = 0.0f, // cooldown for target selection
  4 FLOAT m_tmLastSawTarget = 0.0f, // last time the enemy has been seen
  5 FLOAT m_tmButtonAction = 0.0f, // cooldown for button actions
  6 FLOAT m_tmPosChange = 0.0f, // last time bot has significantly moved
  7 FLOAT3D m_vLastPos = FLOAT3D(0.0f, 0.0f, 0.0f), // last bot position
 
 10 FLOAT m_fTargetDist = 1000.0f, // how far is the following target
 11 FLOAT m_fSideDir = -1.0f,      // prioritize going left or right
 12 FLOAT m_tmChangeBotDir = 0.0f, // when to randomize the side direction
 13 FLOAT3D m_vAccuracy = FLOAT3D(0.0f, 0.0f, 0.0f), // accuracy angle (should be preserved between ticks)
 14 FLOAT m_tmBotAccuracy = 0.0f,  // accuracy update cooldown
 
 20 FLOAT m_tmChangePath = 0.0f,    // path update cooldown
 21 FLOAT m_tmPickImportant = 0.0f, // how often to pick important points
 22 BOOL m_bImportantPoint = FALSE, // focused on the important point or not
 
 30 INDEX m_iBotWeapon = CT_BOT_WEAPONS, // which weapon is currently prioritized
 31 FLOAT m_tmLastBotWeapon = 0.0f, // cooldown for weapon selection
 32 FLOAT m_tmShootTime = -1.0f, // when to shoot the next time

 40 FLOAT m_tmLastItemSearch = 0.0f, // item search cooldown
 41 CEntityPointer m_penLastItem,    // last selected item to run towards

{
  CBotPathPoint *m_pbppCurrent; // current path point
  CBotPathPoint *m_pbppTarget; // target point
  ULONG m_ulPointFlags; // last point's flags

  SBotSettings m_sbsBot; // bot settings

  SBotThoughts m_btThoughts; // [Cecil] TEMP 2021-06-20: Bot thoughts
}

components:
  0 class CLASS_PLAYER "Classes\\Player.ecl",

functions:
  // Constructor
  void CPlayerBot(void) {
    m_pbppCurrent = NULL;
    m_pbppTarget = NULL;
    m_ulPointFlags = 0;
  };

  // Initialize the bot  
  virtual void InitBot(void) {
    m_pbppCurrent = NULL;
    m_pbppTarget = NULL;
    m_ulPointFlags = 0;

    m_tmLastBotTarget = 0.0f;
    m_tmLastSawTarget = 0.0f;
    m_tmPosChange = _pTimer->CurrentTick();
    m_vLastPos = GetPlacement().pl_PositionVector;
    
    m_tmChangePath = 0.0f;
    m_tmPickImportant = 0.0f;
    m_bImportantPoint = FALSE;

    m_tmLastBotWeapon = 0.0f;
    m_tmShootTime = -1.0f;

    // give some time before picking anything up
    m_tmLastItemSearch = _pTimer->CurrentTick() + 1.0f;
    m_penLastItem = NULL;
  };
  
  // Bot destructor
  virtual void EndBot(void) {
    // remove from the bot list
    _cenPlayerBots.Remove(this);
  };

  // Identify as a bot
  virtual BOOL IsBot(void) {
    return TRUE;
  };

  // Write to stream
  void Write_t(CTStream *ostr) {
    CPlayer::Write_t(ostr);
    BotWrite(this, ostr);
  };

  // Read from stream
  void Read_t(CTStream *istr) {
    CPlayer::Read_t(istr);
    BotRead(this, istr);
  };

  // [Cecil] 2021-06-12: Apply fake actions
  void PostMoving(void) {
    CPlayer::PostMoving();
    CPlayer::ApplyAction(CPlayerAction(), 0.0f);
  };

  // Check if selected point is a current one
  virtual BOOL CurrentPoint(CBotPathPoint *pbppExclude) {
    return (pbppExclude != NULL && m_pbppCurrent == pbppExclude);
  };

  // Apply action for bots
  virtual void BotApplyAction(CPlayerAction &paAction) {
    // while alive
    if (GetFlags() & ENF_ALIVE) {
      if (m_penCamera == NULL && m_penActionMarker == NULL) {
        // bot's brain
        SBotLogic sbl;

        // main bot logic
        BotThinking(paAction, sbl);

        // weapon functions
        BotWeapons(paAction, sbl);
      }

    // when dead
    } else {
      // try to respawn
      if (ButtonAction()) {
        paAction.pa_ulButtons |= PLACT_FIRE;
      }
    }
  };

  // Change bot's speed
  virtual void BotSpeed(FLOAT3D &vTranslation) {
    vTranslation(1) *= m_sbsBot.fSpeedMul;
    vTranslation(3) *= m_sbsBot.fSpeedMul;
  }

  // [Cecil] 2018-10-15: Update bot settings
  void UpdateBot(const SBotSettings &sbs) {
    m_sbsBot = sbs;

    // adjust target type
    if (m_sbsBot.iTargetType == -1)
    {
      if (GetSP()->sp_bCooperative || GetSP()->sp_bSinglePlayer) {
        m_sbsBot.iTargetType = 1; // only enemies
      } else {
        m_sbsBot.iTargetType = 2; // enemies and players
      }
    }

    // various player settings
    CPlayerSettings *pps = (CPlayerSettings *)en_pcCharacter.pc_aubAppearance;
    
    // third person view
    if (m_sbsBot.b3rdPerson) {
      pps->ps_ulFlags |= PSF_PREFER3RDPERSON;
    } else {
      pps->ps_ulFlags &= ~PSF_PREFER3RDPERSON;
    }

    // change crosshair type
    if (m_sbsBot.iCrosshair < 0) {
      pps->ps_iCrossHairType = rand() % 7; // randomize
    } else {
      pps->ps_iCrossHairType = m_sbsBot.iCrosshair;
    }
  };

  // [Cecil] 2021-06-16: Perform a button action if possible
  BOOL ButtonAction(void) {
    if (m_tmButtonAction <= _pTimer->CurrentTick()) {
      m_tmButtonAction = _pTimer->CurrentTick() + 0.2f;
      return TRUE;
    }
    return FALSE;
  }

  // [Cecil] 2021-06-16: Select new weapon
  void BotSelectNewWeapon(const WeaponType &wtSelect) {
    // nothing to select or on a cooldown
    if (wtSelect == WEAPON_NONE || m_tmLastBotWeapon > _pTimer->CurrentTick()) {
      return;
    }

    CPlayerWeapons *penWeapons = GetPlayerWeapons();

    // already selected
    if (penWeapons->m_iCurrentWeapon == wtSelect) {
      return;
    }

    // select it
    if (penWeapons->WeaponSelectOk(wtSelect)) {
      penWeapons->SendEvent(EBegin());
      m_tmLastBotWeapon = _pTimer->CurrentTick() + m_sbsBot.fWeaponCD;
    }
  };

  // [Cecil] 2018-10-10: Bot weapon logic
  void BotWeapons(CPlayerAction &pa, SBotLogic &sbl) {
    CPlayerWeapons *penWeapons = GetPlayerWeapons();
    
    // sniper scope
    if (m_sbsBot.bSniperZoom && CanUseScope(this)) {
      UseWeaponScope(this, pa, sbl);
    }

    // pick weapon config
    SBotWeaponConfig *aWeapons = sbl.aWeapons;
    m_iBotWeapon = CT_BOT_WEAPONS - 1;

    // [Cecil] 2021-06-22: Reload weapon if haven't seen the enemy for a while
    if (_pTimer->CurrentTick() - m_tmLastSawTarget > 2.0f && _pTimer->CurrentTick() - m_tmLastSawTarget < 3.0f) {
      pa.pa_ulButtons |= PLACT_RELOAD;
    }

    // pick currently suitable weapon
    WeaponType wtSelect = WEAPON_NONE;
    FLOAT fLastDamage = 0.0f;

    WeaponType wtType;
    FLOAT fMin, fMax, fAccuracy;

    for (INDEX iWeapon = 0; iWeapon < CT_BOT_WEAPONS; iWeapon++) {
      wtType = aWeapons[iWeapon].bw_wtType;

      fMin = aWeapons[iWeapon].bw_fMinDistance;
      fMax = aWeapons[iWeapon].bw_fMaxDistance;
      fAccuracy = aWeapons[iWeapon].bw_fAccuracy;

      // skip unexistent weapons
      if (!WPN_EXISTS(penWeapons, wtType)) {
        continue;
      }

      // not allowed
      if (m_sbsBot.iAllowedWeapons != -1 && !(m_sbsBot.iAllowedWeapons & WPN_FLAG(wtType))) {
        continue;
      }

      // check if distance is okay
      if (m_fTargetDist > fMax || m_fTargetDist < fMin) {
        continue;
      }

      // no ammo
      if (!GetSP()->sp_bInfiniteAmmo && !WPN_HAS_AMMO(penWeapons, wtType)) {
        continue;
      }

      FLOAT fDistRatio = (m_fTargetDist - fMin) / (fMax - fMin); // from min to max [0 .. 1]
      FLOAT fMul = fAccuracy + (1 - fAccuracy) * (1 - fDistRatio); // from min to max [fAccuracy .. 1]

      // check damage
      if (fLastDamage < aWeapons[iWeapon].bw_fDamage * fMul) {
        // select this weapon
        wtSelect = wtType;
        fLastDamage = aWeapons[iWeapon].bw_fDamage * fMul;
        m_iBotWeapon = iWeapon;
      }
    }

    // select new weapon
    BotSelectNewWeapon(wtSelect);
  };

  void BotThinking(CPlayerAction &pa, SBotLogic &sbl) {
    const FLOAT3D &vBotPos = GetPlacement().pl_PositionVector;

    if (DistanceToPos(vBotPos, m_vLastPos) > 2.0f) {
      m_tmPosChange = _pTimer->CurrentTick();
      m_vLastPos = vBotPos;
    }

    // set bot's absolute viewpoint
    sbl.plBotView = en_plViewpoint;
    sbl.plBotView.RelativeToAbsolute(GetPlacement());
    
    // [Cecil] 2018-10-11 / 2018-10-13: Bot targeting and following
    CEntity *penBotTarget = ClosestEnemy(this, m_fTargetDist, sbl);

    // select new target only if it doesn't exist or after a cooldown
    if (ASSERT_ENTITY(m_penTarget) || m_tmLastBotTarget <= _pTimer->CurrentTick()) {
      m_penTarget = penBotTarget;
      m_tmLastBotTarget = _pTimer->CurrentTick() + m_sbsBot.fTargetCD;

      // [Cecil] 2021-06-14: Select new weapon immediately
      m_tmLastBotWeapon = 0.0f;
    }

    m_penFollow = NULL;

    // [Cecil] 2019-05-28: Follow players in cooperative
    if (GetSP()->sp_bCooperative || GetSP()->sp_bSinglePlayer) {
      sbl.ubFlags |= BLF_FOLLOWPLAYER;
    }

    // enemy exists
    if (m_penTarget != NULL) {
      sbl.ubFlags |= BLF_ENEMYEXISTS;
      sbl.peiTarget = (EntityInfo *)m_penTarget->GetEntityInfo();

      // can see the enemy
      if (CastBotRay(this, m_penTarget, sbl, TRUE)) {
        sbl.ubFlags |= BLF_SEEENEMY;
        m_tmLastSawTarget = _pTimer->CurrentTick();
      }
      
      // follow the enemy
      m_penFollow = m_penTarget;
    }

    // aim at the target
    BotAim(this, pa, sbl);

    // shoot if possible
    if (m_sbsBot.bShooting) {
      SBotWeaponConfig &bwWeapon = sbl.aWeapons[m_iBotWeapon];

      // allowed to shoot
      BOOL bCanShoot = sbl.CanShoot();
      
      // only shoot allowed weapons
      if (m_sbsBot.iAllowedWeapons != -1) {
        bCanShoot = bCanShoot && m_sbsBot.iAllowedWeapons & WPN_FLAG(GetPlayerWeapons()->m_iCurrentWeapon);
      }

      // if allowed to shoot
      if (bCanShoot) {
        // enough shooting time
        if (m_tmShootTime <= 0.0f || m_tmShootTime > _pTimer->CurrentTick()) {
          FireWeapon(this, pa, sbl);

        } else if (Abs(m_tmShootTime - _pTimer->CurrentTick()) < 0.05f) {
          THOUGHT("Stop shooting");
        }

        // reset shooting time a few ticks later
        if (m_tmShootTime + 0.05f <= _pTimer->CurrentTick()) {
          // shooting frequency
          FLOAT tmShotFreq = bwWeapon.bw_tmShotFreq;

          // this weapon has a certain shooting frequency
          if (tmShotFreq > 0.0f) {
            m_tmShootTime = _pTimer->CurrentTick() + tmShotFreq;
            THOUGHT(CTString(0, "Shoot for %.2fs", tmShotFreq));

          // no frequency
          } else {
            m_tmShootTime = -1.0f;
          }
        }
      }
    }
    
    // search for items
    BotItemSearch(this, sbl);

    // follow players
    if (sbl.FollowPlayer()) {
      FLOAT fDistToPlayer = -1.0f;
      CEntity *penPlayer = ClosestRealPlayer(this, vBotPos, fDistToPlayer);
      
      // player exists
      if (penPlayer != NULL) {
        // don't follow anything else
        m_penFollow = NULL;

        sbl.ubFlags |= BLF_SEEPLAYER;

        // follow the player
        if (fDistToPlayer > 5.0f) {
          m_penFollow = penPlayer;
          sbl.ubFlags |= BLF_FOLLOWING;

          // player is too far
          if (fDistToPlayer > 100.0f || !CastBotRay(this, penPlayer, sbl, TRUE)) {
            sbl.ubFlags &= ~BLF_SEEPLAYER;
          }

        } else if (fDistToPlayer < 2.0f) {
          m_penFollow = penPlayer;
          sbl.ubFlags |= BLF_BACKOFF;
        }

        // look at the player
        if (!sbl.SeeEnemy() && sbl.SeePlayer()) {
          // relative position
          CPlacement3D plToPlayer(penPlayer->GetPlacement().pl_PositionVector - vBotPos, sbl.ViewAng());

          // angle towards the target
          FLOAT2D vToPlayer = FLOAT2D(GetRelH(plToPlayer), GetRelP(plToPlayer));

          // set rotation speed
          sbl.aAim(1) = vToPlayer(1) / 0.5f;
          sbl.aAim(2) = vToPlayer(2) / 0.5f;
        }
      }
    }

    // try to find a path to the target
    BotPathFinding(this, sbl);

    // aim
    pa.pa_aRotation(1) += sbl.aAim(1);
    pa.pa_aRotation(2) += sbl.aAim(2);

    // set bot movement
    BotMovement(this, pa, sbl);
  };

procedures:
  // Entry point
  Main() {
    // add to the bot list
    _cenPlayerBots.Add(this);

    // initialize the player
    jump CPlayer::SubMain();
  };
};
