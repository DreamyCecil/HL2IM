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

#include "StdH.h"
#include "SandboxActions.h"
#include "BotFunctions.h"
#include "NetworkPatch/ServerIntegration.h"

// [Cecil] 2021-06-18: For weapon switching
#include "EntitiesMP/PlayerMarker.h"

// [Cecil] 2021-06-19: Render entity IDs
extern INDEX MOD_bEntityIDs = FALSE;
// [Cecil] 2021-06-21: Display bot thoughts
extern INDEX MOD_bBotThoughts = FALSE;

// [Cecil] 2019-06-02: Bot names and skins
static CStaticArray<CTString> BOT_astrNames;
static CStaticArray<CTString> BOT_astrSkins;

// [Cecil] 2018-10-15: Bot Editing
static CTString BOT_strBotEdit = ""; // name of a bot to edit
static CTString BOT_strSpawnName = ""; // name to spawn with

// [Cecil] 2020-07-28: A structure with bot settings
static SBotSettings _sbsBotSettings;

// [Cecil] 2019-11-07: Special client packet for NavMesh editing
static CNetworkMessage CECIL_NavMeshClientPacket(const INDEX &iAction) {
  NEW_PACKET(nmNavmesh, MSG_CECIL_SANDBOX);
  nmNavmesh << LOCAL_PLAYER_INDEX; // local player
  nmNavmesh << (INDEX)_pNetwork->IsServer(); // it's a server
  nmNavmesh << iAction; // specific NavMesh action

  return nmNavmesh;
};

// [Cecil] 2019-11-07: Special server packet for bots
static CCecilStreamBlock CECIL_BotServerPacket(const INDEX &iAction) {
  CServer &srvServer = _pNetwork->ga_srvServer;

  CCecilStreamBlock nsbBot(MSG_CECIL_SANDBOX, ++srvServer.srv_iLastProcessedSequence);
  nsbBot << LOCAL_PLAYER_INDEX; // local player
  nsbBot << (INDEX)TRUE; // it's a server
  nsbBot << iAction; // specific NavMesh action

  return nsbBot;
};

// --- Bot manipulation

// [Cecil] 2018-10-15: Config reset
static void CECIL_ResetBotConfig(void) {
  CPrintF(BOTCOM_NAME("ResetBotConfig:\n"));

  _sbsBotSettings.Reset();
  CPrintF("  Bot config has been reset!\n");
};

// [Cecil] 2018-10-09: Bot adding
static void CECIL_AddBot(CTString *pstrBotName, CTString *pstrBotSkin) {
  CTString strBotName = *pstrBotName;
  CTString strBotSkin = *pstrBotSkin;

  CPrintF(MODCOM_NAME("AddBot:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }
  
  // pick random name and skin
  const INDEX ctNames = BOT_astrNames.Count();
  const INDEX ctSkins = BOT_astrSkins.Count();
  CTString strName = (ctNames > 0) ? BOT_astrNames[rand() % ctNames] : "Bot";
  CTString strSkin = (ctSkins > 0) ? BOT_astrSkins[rand() % ctSkins] : "SeriousSam";

  // replace random name and skin
  if (strBotName != "") {
    strName = strBotName;
  }
  if (strBotSkin != "") {
    strSkin = strBotSkin;
  }

  CPlayerCharacter pcBot;
  CPlayerSettings *pps = (CPlayerSettings *)pcBot.pc_aubAppearance;

  pps->ps_iWeaponAutoSelect = PS_WAS_NONE; // never select new weapons
  memset(pps->ps_achModelFile, 0, sizeof(pps->ps_achModelFile));
  strncpy(pps->ps_achModelFile, strSkin, sizeof(pps->ps_achModelFile));

  for (INDEX iGUID = 0; iGUID < 16; iGUID++) {
    pcBot.pc_aubGUID[iGUID] = rand() % 256;
  }

  pcBot.pc_strName = strName;
  pcBot.pc_strTeam = "CECIL_BOTZ";

  // create message for adding player data to sessions
  CCecilStreamBlock nsbAddBot = CECIL_BotServerPacket(ESA_ADDBOT);
  nsbAddBot << pcBot; // character data
  nsbAddBot << _sbsBotSettings; // update bot settings

  // put the message in buffer to be sent to all servers
  CECIL_AddBlockToAllSessions(nsbAddBot);
};

static void CECIL_QuickBot(void) {
  CTString strName = BOT_strSpawnName;
  CTString strSkin = "";
  CECIL_AddBot(&strName, &strSkin);
};

// [Cecil] 2018-10-14: Bot removing
static void CECIL_RemoveAllBots(void) {
  CPrintF(MODCOM_NAME("RemoveAllBots:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }

  INDEX iBot = 0;
  BOOL bRemoved = FALSE;

  for (iBot = 0; iBot < _cenPlayerBots.Count(); iBot++) {
    CPlayerBot *penBot = _cenPlayerBots.Pointer(iBot);

    if (!ASSERT_ENTITY(penBot)) {
      continue;
    }

    // create message for removing player from all session
    CCecilStreamBlock nsbRemPlayerData = CECIL_BotServerPacket(ESA_REMBOT);
    nsbRemPlayerData << iBot; // bot index

    // put the message in buffer to be sent to all sessions
    CECIL_AddBlockToAllSessions(nsbRemPlayerData);

    bRemoved = TRUE;
  }

  if (!bRemoved) {
    CPrintF("  <no bots in the current session>\n");
  } else {
    CPrintF("  <removed %d bots>\n", iBot);
  }
}

static void CECIL_RemoveBot(CTString *pstrBotName) {
  CPrintF(MODCOM_NAME("RemoveBot:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }

  CTString strBotName = *pstrBotName;
  BOOL bRemoved = FALSE;

  for (INDEX iBot = 0; iBot < _cenPlayerBots.Count(); iBot++) {
    CPlayerBot *penBot = _cenPlayerBots.Pointer(iBot);

    if (!ASSERT_ENTITY(penBot)) {
      continue;
    }

    // if bot name matches
    if (penBot->GetName().Undecorated().Matches(strBotName)) {
      // create message for removing player from all session
      CCecilStreamBlock nsbRemPlayerData = CECIL_BotServerPacket(ESA_REMBOT);
      nsbRemPlayerData << iBot; // bot index

      // put the message in buffer to be sent to all sessions
      CECIL_AddBlockToAllSessions(nsbRemPlayerData);

      bRemoved = TRUE;
    }
  }

  if (!bRemoved) {
    CPrintF("  <no bots with the name '%s'>\n", strBotName);
  } else {
    CPrintF("  <removed bots with the name '%s'>\n", strBotName);
  }
};

// [Cecil] 2018-10-15: Bot updating
static void CECIL_BotUpdate(void) {
  CPrintF(MODCOM_NAME("BotUpdate:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }

  CCecilStreamBlock nsbBotUpdate = CECIL_BotServerPacket(ESA_UPDATEBOT);
  nsbBotUpdate << BOT_strBotEdit; // Bot name
  nsbBotUpdate << _sbsBotSettings; // Bot settings

  // put the message in buffer to be sent to all sessions
  CECIL_AddBlockToAllSessions(nsbBotUpdate);
};

// [Cecil] 2021-06-18: Change all weapons
static void CECIL_SetWeapons(INDEX iWeapon, INDEX bPlayer) {
  CPrintF(MODCOM_NAME("SetWeapons:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }

  CCecilStreamBlock nsbSetWeapons = CECIL_BotServerPacket(ESA_SETWEAPONS);
  nsbSetWeapons << iWeapon; // weapon type
  nsbSetWeapons << (UBYTE)bPlayer; // player weapons

  // put the message in buffer to be sent to all sessions
  CECIL_AddBlockToAllSessions(nsbSetWeapons);
};

// --- Navmesh creation

// [Cecil] 2018-11-10: Quick Function For NavMeshGenerator
static void CECIL_GenerateNavMesh(INDEX iPoints) {
  CPrintF(MODCOM_NAME("GenerateNavMesh:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }

  CCecilStreamBlock nsbNavMesh = CECIL_BotServerPacket(ESA_NAVMESH_GEN);
  nsbNavMesh << Clamp(iPoints, 0L, 1L); // Connect points or generate them

  // put the message in buffer to be sent to all sessions
  CECIL_AddBlockToAllSessions(nsbNavMesh);
};

// [Cecil] 2019-05-28: Quick functions for NavMesh states
static void CECIL_NavMeshSave(void) {
  CPrintF(MODCOM_NAME("NavMeshSave:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }

  CCecilStreamBlock nsbNavMesh = CECIL_BotServerPacket(ESA_NAVMESH_STATE);
  nsbNavMesh << (INDEX)0; // Save state

  // put the message in buffer to be sent to all sessions
  CECIL_AddBlockToAllSessions(nsbNavMesh);
};

static void CECIL_NavMeshLoad(void) {
  CPrintF(MODCOM_NAME("NavMeshLoad:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }
  
  CCecilStreamBlock nsbNavMesh = CECIL_BotServerPacket(ESA_NAVMESH_STATE);
  nsbNavMesh << (INDEX)1; // Load state

  // put the message in buffer to be sent to all sessions
  CECIL_AddBlockToAllSessions(nsbNavMesh);
};

// [Cecil] 2021-06-16: Quick function for NavMesh clearing
static void CECIL_NavMeshClear(INDEX iPoints) {
  CPrintF(MODCOM_NAME("NavMeshClear:\n"));

  if (!_pNetwork->IsServer()) {
    CPrintF("  <not a server>\n");
    return;
  }
  
  // put the message in buffer to be sent to all sessions
  CCecilStreamBlock nsbNavMesh = CECIL_BotServerPacket(ESA_NAVMESH_CLEAR);
  CECIL_AddBlockToAllSessions(nsbNavMesh);
};

// --- Navmesh editing

// [Cecil] 2019-05-28: Add new NavMesh point with vertical offset
static void CECIL_AddNavMeshPoint(FLOAT fOffset) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_CREATE);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << MOD_iNavMeshConnecting;
  nmNavmesh << fOffset;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2019-05-28: Delete NavMesh point
static void CECIL_DeleteNavMeshPoint(void) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_DELETE);
  nmNavmesh << MOD_iNavMeshPoint;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2019-05-28: Display NavMesh point info
static void CECIL_NavMeshPointInfo(void) {
  CPrintF(MODCOM_NAME("NavMeshPointInfo: "));

  CBotPathPoint *pbpp = _pNavmesh->FindPointByID(MOD_iNavMeshPoint);

  if (pbpp == NULL) {
    CPrintF("NavMesh point doesn't exist!\n");
    return;
  }

  CPrintF("^cffffff%d\n", pbpp->bpp_iIndex); // point index on top

  CEntity *penImportant = pbpp->bpp_penImportant;
  
  CPrintF("Connections: %d\n", pbpp->bpp_cbppPoints.Count());
  CPrintF("Pos:    %.2f, %.2f, %.2f\n", pbpp->bpp_vPos(1), pbpp->bpp_vPos(2), pbpp->bpp_vPos(3));
  CPrintF("Range:  %.2f\n", pbpp->bpp_fRange);
  CPrintF("Flags:  %s\n", ULongToBinary(pbpp->bpp_ulFlags));
  CPrintF("Entity: \"%s\"\n", (penImportant == NULL) ? "<none>" : penImportant->GetName());
  CPrintF("Next:   %d\n", (pbpp->bpp_pbppNext == NULL) ? -1 : pbpp->bpp_pbppNext->bpp_iIndex);
};

// [Cecil] 2021-06-12: Connect current NavMesh point to another one
static void CECIL_ConnectNavMeshPoint(INDEX iTargetPoint) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_CONNECT);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << iTargetPoint;
  nmNavmesh << UBYTE(MOD_iNavMeshConnecting);

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2021-06-21: Untarget current NavMesh point from another one
static void CECIL_UntargetNavMeshPoint(INDEX iTargetPoint) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_UNTARGET);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << iTargetPoint;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2021-06-18: Move NavMesh point to the player position
static void CECIL_TeleportNavMeshPoint(FLOAT fOffset) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_TELEPORT);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << fOffset;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2021-06-18: Change NavMesh point absolute position
static void CECIL_NavMeshPointPos(FLOAT fX, FLOAT fY, FLOAT fZ) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_POS);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << fX << fY << fZ;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2021-06-18: Snap NavMesh point position to a custom-sized grid
static void CECIL_SnapNavMeshPoint(FLOAT fGridSize) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_SNAP);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << fGridSize;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2019-06-04: Change NavMesh point flags
static void CECIL_NavMeshPointFlags(INDEX iFlags) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_FLAGS);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << iFlags;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2019-06-05: Change NavMesh point important entity
static void CECIL_NavMeshPointEntity(INDEX iEntityID) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_ENTITY);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << iEntityID;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2019-06-06: Change NavMesh point range
static void CECIL_NavMeshPointRange(FLOAT fRange) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_RANGE);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << fRange;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2021-06-25: Change NavMesh point next important point
static void CECIL_NavMeshPointNext(INDEX iNextPoint) {
  CNetworkMessage nmNavmesh = CECIL_NavMeshClientPacket(ESA_NAVMESH_NEXT);
  nmNavmesh << MOD_iNavMeshPoint;
  nmNavmesh << iNextPoint;

  _pNetwork->SendToServerReliable(nmNavmesh);
};

// [Cecil] 2021-06-23: Add NavMesh point range
static void CECIL_AddNavMeshPointRange(FLOAT fRange) {
  CBotPathPoint *pbpp = _pNavmesh->FindPointByID(MOD_iNavMeshPoint);

  if (pbpp == NULL) {
    CPrintF("NavMesh point doesn't exist!\n");
    return;
  }

  FLOAT fNewRange = ClampDn(pbpp->bpp_fRange + fRange, 0.0f);
  CECIL_NavMeshPointRange(fNewRange);
};

// [Cecil] 2019-05-28: NavMesh Point Selection
static void CECIL_NavMeshSelectPoint(void) {
  if (LOCAL_PLAYER_INDEX == -1) {
    return;
  }

  CPlayer *pen = (CPlayer *)CEntity::GetPlayerEntity(LOCAL_PLAYER_INDEX);
  CBotPathPoint *pbppNearest = NearestNavMeshPointPos(pen, pen->GetPlayerWeapons()->m_vRayHit);

  // no point
  if (pbppNearest == NULL) {
    return;
  }
      
  // point target selection
  CBotPathPoint *pbppConnect = _pNavmesh->FindPointByID(MOD_iNavMeshPoint);
      
  if (MOD_iNavMeshConnecting > 0 && pbppConnect != NULL) {
    CECIL_ConnectNavMeshPoint(pbppNearest->bpp_iIndex);
        
  } else {
    MOD_iNavMeshPoint = pbppNearest->bpp_iIndex;
  }
};

// [Cecil] 2021-06-13: Change NavMesh connection type
static void CECIL_NavMeshConnectionType(void) {
  MOD_iNavMeshConnecting = (MOD_iNavMeshConnecting + 1) % 4;

  CPrintF(MODCOM_NAME("iNavMeshConnecting = %d "), MOD_iNavMeshConnecting);

  switch (MOD_iNavMeshConnecting) {
    case 0: CPrintF("(disabled)\n"); break;
    case 1: CPrintF("(one-way connection)\n"); break;
    case 2: CPrintF("(two-way connection)\n"); break;
    case 3: CPrintF("(one-way backwards connection)\n"); break;
    default: CPrintF("(other)\n");
  }
};

// [Cecil] 2021-06-23: Initialize sandbox actions
extern void CECIL_InitSandboxActions(void) {
  // [Cecil] Bot mod
  _pShell->DeclareSymbol("user void " MODCOM_NAME("QuickBot(void);"), &CECIL_QuickBot);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("AddBot(CTString, CTString);"), &CECIL_AddBot);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("RemoveBot(CTString);"), &CECIL_RemoveBot);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("RemoveAllBots(void);"), &CECIL_RemoveAllBots);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("BotUpdate(void);"), &CECIL_BotUpdate);

  _pShell->DeclareSymbol("user void " MODCOM_NAME("GenerateNavMesh(INDEX);"), &CECIL_GenerateNavMesh);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshSave(void);"), &CECIL_NavMeshSave);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshLoad(void);"), &CECIL_NavMeshLoad);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshClear(void);"), &CECIL_NavMeshClear);

  // [Cecil] Misc
  _pShell->DeclareSymbol("user INDEX " MODCOM_NAME("bEntityIDs;"), &MOD_bEntityIDs);
  _pShell->DeclareSymbol("persistent user INDEX " MODCOM_NAME("bBotThoughts;"), &MOD_bBotThoughts);

  _pShell->DeclareSymbol("user void " MODCOM_NAME("SetWeapons(INDEX, INDEX);"), &CECIL_SetWeapons);

  // [Cecil] Bot editing
  _pShell->DeclareSymbol("user CTString " BOTCOM_NAME("strBotEdit;"), &BOT_strBotEdit);
  _pShell->DeclareSymbol("persistent user CTString " BOTCOM_NAME("strSpawnName;"), &BOT_strSpawnName);

  _pShell->DeclareSymbol("user void " BOTCOM_NAME("ResetBotConfig(void);"), &CECIL_ResetBotConfig);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("b3rdPerson;"      ), &_sbsBotSettings.b3rdPerson);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("iCrosshair;"      ), &_sbsBotSettings.iCrosshair);

  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("bSniperZoom;"     ), &_sbsBotSettings.bSniperZoom);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("bShooting;"       ), &_sbsBotSettings.bShooting);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fShootAngle;"     ), &_sbsBotSettings.fShootAngle);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fAccuracyAngle;"  ), &_sbsBotSettings.fAccuracyAngle);

  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fRotSpeedDist;"   ), &_sbsBotSettings.fRotSpeedDist);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fRotSpeedMin;"    ), &_sbsBotSettings.fRotSpeedMin);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fRotSpeedMax;"    ), &_sbsBotSettings.fRotSpeedMax);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fRotSpeedLimit;"  ), &_sbsBotSettings.fRotSpeedLimit);

  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fWeaponCD;"       ), &_sbsBotSettings.fWeaponCD);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fTargetCD;"       ), &_sbsBotSettings.fTargetCD);

  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fSpeedMul;"       ), &_sbsBotSettings.fSpeedMul);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("bStrafe;"         ), &_sbsBotSettings.bStrafe);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("bJump;"           ), &_sbsBotSettings.bJump);

  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fPrediction;"     ), &_sbsBotSettings.fPrediction);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fPredictRnd;"     ), &_sbsBotSettings.fPredictRnd);

  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("iAllowedWeapons;" ), &_sbsBotSettings.iAllowedWeapons);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("iTargetType;"     ), &_sbsBotSettings.iTargetType);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("bTargetSearch;"   ), &_sbsBotSettings.bTargetSearch);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fImportantChance;"), &_sbsBotSettings.fImportantChance);
  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("bItemSearch;"     ), &_sbsBotSettings.bItemSearch);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fItemSearchCD;"   ), &_sbsBotSettings.fItemSearchCD);

  _pShell->DeclareSymbol("persistent user INDEX " BOTCOM_NAME("bItemVisibility;" ), &_sbsBotSettings.bItemVisibility);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fWeaponDist;"     ), &_sbsBotSettings.fWeaponDist);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fHealthSearch;"   ), &_sbsBotSettings.fHealthSearch);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fHealthDist;"     ), &_sbsBotSettings.fHealthDist);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fArmorDist;"      ), &_sbsBotSettings.fArmorDist);
  _pShell->DeclareSymbol("persistent user FLOAT " BOTCOM_NAME("fAmmoDist;"       ), &_sbsBotSettings.fAmmoDist);

  // [Cecil] NavMesh editing
  _pShell->DeclareSymbol("persistent user INDEX " MODCOM_NAME("iRenderNavMesh;"), &MOD_iRenderNavMesh);
  _pShell->DeclareSymbol("user INDEX " MODCOM_NAME("iNavMeshPoint;"), &MOD_iNavMeshPoint);
  _pShell->DeclareSymbol("user INDEX " MODCOM_NAME("iNavMeshConnecting;"), &MOD_iNavMeshConnecting);

  _pShell->DeclareSymbol("user void " MODCOM_NAME("AddNavMeshPoint(FLOAT);"), &CECIL_AddNavMeshPoint);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("DeleteNavMeshPoint(void);"), &CECIL_DeleteNavMeshPoint);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshPointInfo(void);"), &CECIL_NavMeshPointInfo);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("ConnectNavMeshPoint(INDEX);"), &CECIL_ConnectNavMeshPoint);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("UntargetNavMeshPoint(INDEX);"), &CECIL_UntargetNavMeshPoint);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("TeleportNavMeshPoint(FLOAT);"), &CECIL_TeleportNavMeshPoint);

  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshPointPos(FLOAT, FLOAT, FLOAT);"), &CECIL_NavMeshPointPos);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("SnapNavMeshPoint(FLOAT);"), &CECIL_SnapNavMeshPoint);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshPointFlags(INDEX);"), &CECIL_NavMeshPointFlags);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshPointEntity(INDEX);"), &CECIL_NavMeshPointEntity);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshPointRange(FLOAT);"), &CECIL_NavMeshPointRange);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshPointNext(INDEX);"), &CECIL_NavMeshPointNext);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("AddNavMeshPointRange(FLOAT);"), &CECIL_AddNavMeshPointRange);

  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshSelectPoint(void);"), &CECIL_NavMeshSelectPoint);
  _pShell->DeclareSymbol("user void " MODCOM_NAME("NavMeshConnectionType(void);"), &CECIL_NavMeshConnectionType);

  // load bot names
  try {
    CTFileStream strmNames;
    strmNames.Open_t(CTFILENAME("Cecil\\Bots\\BotNames.txt"));

    // clear names list
    BOT_astrNames.Clear();

    // fill names array
    while (!strmNames.AtEOF()) {
      CTString str = "";
      strmNames.GetLine_t(str);

      INDEX ctNames = BOT_astrNames.Count();
      BOT_astrNames.Expand(ctNames + 1);
      BOT_astrNames[ctNames] = str;
    }

    strmNames.Close();
  } catch (char *strError) {
    CPrintF("%s\n", strError);
  }

  // load bot skins
  try {
    CTFileStream strmSkins;
    strmSkins.Open_t(CTFILENAME("Cecil\\Bots\\BotSkins.txt"));

    // clear skins list
    BOT_astrSkins.Clear();

    // fill skins array
    while (!strmSkins.AtEOF()) {
      CTString str = "";
      strmSkins.GetLine_t(str);

      INDEX ctSkins = BOT_astrSkins.Count();
      BOT_astrSkins.Expand(ctSkins + 1);
      BOT_astrSkins[ctSkins] = str;
    }

    strmSkins.Close();
  } catch (char *strError) {
    CPrintF("%s\n", strError);
  }
};

// Receive and perform a sandbox action
void CECIL_SandboxAction(CPlayer *pen, const INDEX &iAction, const BOOL &bAdmin, CNetworkMessage &nmMessage) {
  BOOL bLocal = _pNetwork->IsPlayerLocal(pen);
  CWorld &wo = _pNetwork->ga_World;

  switch (iAction) {
    // [Cecil] 2019-06-03: Add a new bot to the game
    case ESA_ADDBOT: {
      CPlayerCharacter pcBot;
      nmMessage >> pcBot; // player character

      SBotSettings sbsSettings;
      nmMessage >> sbsSettings;

      // delete all predictors
      wo.DeletePredictors();

      // if there is no entity with that character in the world
      CPlayerBot *penNewBot = (CPlayerBot *)wo.FindEntityWithCharacter(pcBot);

      if (penNewBot == NULL) {
        // create an entity for it
        CPlacement3D pl(FLOAT3D(0.0f, 0.0f, 0.0f), ANGLE3D(0.0f, 0.0f, 0.0f));

        try {
          CTFileName fnmPlayer = CTString("Classes\\PlayerBot.ecl");
          penNewBot = (CPlayerBot *)wo.CreateEntity_t(pl, fnmPlayer);

          // attach the character to it
          penNewBot->en_pcCharacter = pcBot;

          // update settings and initialize
          penNewBot->UpdateBot(sbsSettings);
          penNewBot->Initialize();

          CPrintF(TRANS("Added bot '%s^r'\n"), penNewBot->GetPlayerName());

        } catch (char *strError) {
          FatalError(TRANS("Cannot load PlayerBot class:\n%s"), strError);
        }

      } else {
        CPrintF(TRANS("Player entity with the given character already exists!\n"));
      }
    } break;

    // [Cecil] 2021-06-12: Remove the bot
    case ESA_REMBOT: {
      INDEX iBot;
      nmMessage >> iBot; // bot index

      CPlayerBot *penBot = _cenPlayerBots.Pointer(iBot);

      // delete all predictors
      wo.DeletePredictors();

      // inform entity of disconnnection
      CPrintF(TRANS("Removed %s\n"), penBot->GetPlayerName());
      penBot->Disconnect();
    } break;

    // Bot updating
    case ESA_UPDATEBOT: {
      CTString strBotEdit;
      nmMessage >> strBotEdit;

      SBotSettings sbsSettings;
      nmMessage >> sbsSettings;

      for (INDEX iBot = 0; iBot < _cenPlayerBots.Count(); iBot++) {
        CPlayerBot *penBot = _cenPlayerBots.Pointer(iBot);

        // for only one specific bot or all bots
        if (strBotEdit == "" || penBot->GetName().Undecorated().Matches(strBotEdit)) {
          penBot->UpdateBot(sbsSettings);
          CPrintF(" Updated Bot: %s^r\n", penBot->GetName());
        }
      }
    } break;

    // Change all weapons
    case ESA_SETWEAPONS: {
      INDEX iWeapon;
      nmMessage >> iWeapon;
      UBYTE bPlayer;
      nmMessage >> bPlayer;

      // add default weapons to the desired one
      INDEX iSetWeapons = WPN_DEFAULT_MASK | iWeapon;

      FOREACHINDYNAMICCONTAINER(wo.wo_cenEntities, CEntity, iten) {
        CEntity *penFound = iten;

        if (!bPlayer) {
          if (!IsDerivedFromDllClass(penFound, CWeaponItem_DLLClass)) {
            continue;
          }

          ((CWeaponItem *)penFound)->m_EwitType = (WeaponItemType)iWeapon;
          penFound->Reinitialize();

        } else {
          // player markers
          if (IsDerivedFromDllClass(penFound, CPlayerMarker_DLLClass)) {
            ((CPlayerMarker *)penFound)->m_iGiveWeapons = iSetWeapons;
          }

          // current player weapons
          if (IsDerivedFromDllClass(penFound, CPlayerWeapons_DLLClass)) {
            ((CPlayerWeapons *)penFound)->m_iAvailableWeapons = iSetWeapons;

            for (INDEX iAddAmmo = WEAPON_NONE; iAddAmmo < WEAPON_LAST; iAddAmmo++) {
              INDEX iAddAmmoFlag = WPN_FLAG(iAddAmmo);

              if (iSetWeapons & iAddAmmoFlag) {
                ((CPlayerWeapons *)penFound)->AddDefaultAmmoForWeapon(iAddAmmo, 0);
              }
            }

            // force change from the current weapon
            ((CPlayerWeapons *)penFound)->WeaponSelectOk(WPN_DEFAULT_2);
            penFound->SendEvent(EBegin());
          }
        }
      }

      if (!bPlayer) {
        CPrintF("Replaced all weapon items with \"%s\"\n", WeaponItemType_enum.NameForValue(iWeapon));
      } else {
        CPrintF("Set all PlayerMarkers and PlayerWeapons to %d\n", iSetWeapons);
      }
    } break;

    // NavMesh generation
    case ESA_NAVMESH_GEN: {
      INDEX iPoints;
      nmMessage >> iPoints;

      if (iPoints) {
        CTFileName fnClass = CTString("Classes\\NavMeshGenerator.ecl");
        CEntity *penNew = wo.CreateEntity_t(CPlacement3D(FLOAT3D(0, 0, 0), ANGLE3D(0, 0, 0)), fnClass);
        penNew->Initialize();

      } else {
        if (_pNavmesh->bnm_bGenerated) {
          _pNavmesh->ClearNavMesh();
          CPrintF("[NavMeshGenerator]: NavMesh has been cleared\n");

        } else {
          CPrintF("[NavMeshGenerator]: Generating points...\n");
          _pNavmesh->GenerateNavmesh(&wo);
          _pNavmesh->bnm_bGenerated = TRUE;
        }
      }
    } break;

    // NavMesh state
    case ESA_NAVMESH_STATE: {
      INDEX iLoad;
      nmMessage >> iLoad;
        
      try {
        // load NavMesh
        if (iLoad) {
          _pNavmesh->Load(wo);

        // save NavMesh
        } else {
          _pNavmesh->Save(wo);
        }

      } catch (char *strError) {
        CPrintF("%s\n", strError);

        if (iLoad) {
          _pNavmesh->ClearNavMesh();
        }
      }
    } break;
    
    // NavMesh clearing
    case ESA_NAVMESH_CLEAR: {
      CPrintF("NavMesh has been cleared\n");
      _pNavmesh->ClearNavMesh();
    } break;

    // NavMesh editing
    case ESA_NAVMESH_CREATE: {
      INDEX iTargetPoint, iConnect;
      nmMessage >> iTargetPoint >> iConnect;
      FLOAT fOffset;
      nmMessage >> fOffset;

      // no player
      if (pen == NULL) {
        break;
      }

      FLOAT3D vPoint = pen->GetPlacement().pl_PositionVector + FLOAT3D(0.0f, fOffset, 0.0f) * pen->GetRotationMatrix();

      // snap to a small grid
      Snap(vPoint(1), 0.25f);
      Snap(vPoint(3), 0.25f);

      CBotPathPoint *pbppNext = _pNavmesh->AddPoint(vPoint, NULL);

      // connect with the previous point like in a chain
      if (iConnect > 0) {
        CBotPathPoint *pbppPrev = _pNavmesh->FindPointByID(iTargetPoint);

        if (pbppPrev != NULL) {
          pbppPrev->Connect(pbppNext, iConnect);
        }
      }

      MOD_iNavMeshPoint = pbppNext->bpp_iIndex;
    } break;

    case ESA_NAVMESH_DELETE: {
      INDEX iCurrentPoint;
      nmMessage >> iCurrentPoint;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp != NULL) {
        // remove this point from every connection
        FOREACHINDYNAMICCONTAINER(_pNavmesh->bnm_cbppPoints, CBotPathPoint, itbpp) {
          CBotPathPoint *pbppCheck = itbpp;

          // remove connection with this point
          if (pbppCheck->bpp_cbppPoints.IsMember(pbpp)) {
            pbppCheck->bpp_cbppPoints.Remove(pbpp);
          }
        }

        // remove point from the NavMesh
        _pNavmesh->bnm_cbppPoints.Remove(pbpp);
        delete pbpp;

        _pShell->Execute("MOD_iNavMeshPoint = -1;");
      }
    } break;

    case ESA_NAVMESH_CONNECT: {
      INDEX iCurrentPoint, iTargetPoint;
      nmMessage >> iCurrentPoint >> iTargetPoint;
      UBYTE iConnect;
      nmMessage >> iConnect;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        CBotPathPoint *pbppTarget = _pNavmesh->FindPointByID(iTargetPoint);
        pbpp->Connect(pbppTarget, iConnect);

        CPrintF("Connected points %d and %d (type: %d)\n", iCurrentPoint, iTargetPoint, iConnect);
      }
    } break;

    case ESA_NAVMESH_UNTARGET: {
      INDEX iCurrentPoint, iTargetPoint;
      nmMessage >> iCurrentPoint >> iTargetPoint;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        CBotPathPoint *pbppTarget = _pNavmesh->FindPointByID(iTargetPoint);

        if (pbpp->bpp_cbppPoints.IsMember(pbppTarget)) {
          pbpp->bpp_cbppPoints.Remove(pbppTarget);
          CPrintF("Untargeted point %d from %d\n", iTargetPoint, iCurrentPoint);

        } else {
          CPrintF("Point %d is not targeted!\n", iTargetPoint);
        }
      }
    } break;

    case ESA_NAVMESH_TELEPORT: {
      INDEX iCurrentPoint;
      nmMessage >> iCurrentPoint;
      FLOAT fOffset;
      nmMessage >> fOffset;

      // no player
      if (pen == NULL) {
        break;
      }

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        FLOAT3D vLastPos = pbpp->bpp_vPos;
        pbpp->bpp_vPos = pen->GetPlacement().pl_PositionVector + FLOAT3D(0.0f, fOffset, 0.0f) * pen->GetRotationMatrix();

        CPrintF("Point's position: [%.2f, %.2f, %.2f] -> [%.2f, %.2f, %.2f]\n",
                vLastPos(1), vLastPos(2), vLastPos(3), pbpp->bpp_vPos(1), pbpp->bpp_vPos(2), pbpp->bpp_vPos(3));
      }
    } break;

    case ESA_NAVMESH_POS: {
      INDEX iCurrentPoint;
      nmMessage >> iCurrentPoint;
      FLOAT fX, fY, fZ;
      nmMessage >> fX >> fY >> fZ;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        FLOAT3D vLastPos = pbpp->bpp_vPos;
        pbpp->bpp_vPos = FLOAT3D(fX, fY, fZ);

        CPrintF("Point's position: [%.2f, %.2f, %.2f] -> [%.2f, %.2f, %.2f]\n",
                vLastPos(1), vLastPos(2), vLastPos(3), pbpp->bpp_vPos(1), pbpp->bpp_vPos(2), pbpp->bpp_vPos(3));
      }
    } break;

    case ESA_NAVMESH_SNAP: {
      INDEX iCurrentPoint;
      nmMessage >> iCurrentPoint;
      FLOAT fGridSize;
      nmMessage >> fGridSize;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        FLOAT3D vLastPos = pbpp->bpp_vPos;

        for (INDEX iPos = 1; iPos <= 3; iPos++) {
          Snap(pbpp->bpp_vPos(iPos), fGridSize);
        }

        CPrintF("Point's position: [%.2f, %.2f, %.2f] -> [%.2f, %.2f, %.2f]\n",
                vLastPos(1), vLastPos(2), vLastPos(3), pbpp->bpp_vPos(1), pbpp->bpp_vPos(2), pbpp->bpp_vPos(3));
      }
    } break;

    case ESA_NAVMESH_FLAGS: {
      INDEX iCurrentPoint, iFlags;
      nmMessage >> iCurrentPoint >> iFlags;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        ULONG ulFlags = pbpp->bpp_ulFlags;
        pbpp->bpp_ulFlags = (ULONG)iFlags;

        CPrintF("Point's flags: %s -> %s\n", ULongToBinary(ulFlags), ULongToBinary((ULONG)iFlags));
      }
    } break;

    case ESA_NAVMESH_ENTITY: {
      INDEX iCurrentPoint, iEntityID;
      nmMessage >> iCurrentPoint >> iEntityID;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        pbpp->bpp_penImportant = FindEntityByID(&wo, iEntityID);

        CPrintF("Changed point's entity to %d\n", iEntityID);
      }
    } break;

    case ESA_NAVMESH_RANGE: {
      INDEX iCurrentPoint;
      nmMessage >> iCurrentPoint;
      FLOAT fRange;
      nmMessage >> fRange;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        FLOAT fOldRange = pbpp->bpp_fRange;
        pbpp->bpp_fRange = fRange;

        CPrintF("Changed point's range from %s to %s\n", FloatToStr(fOldRange), FloatToStr(fRange));
      }
    } break;

    case ESA_NAVMESH_NEXT: {
      INDEX iCurrentPoint, iNextPoint;
      nmMessage >> iCurrentPoint >> iNextPoint;

      CBotPathPoint *pbpp = _pNavmesh->FindPointByID(iCurrentPoint);

      if (pbpp == NULL) {
        CPrintF("NavMesh point doesn't exist!\n");

      } else {
        INDEX iLastNext = (pbpp->bpp_pbppNext == NULL) ? -1 : pbpp->bpp_pbppNext->bpp_iIndex;
        pbpp->bpp_pbppNext = _pNavmesh->FindPointByID(iNextPoint);

        INDEX iNewNext = (pbpp->bpp_pbppNext == NULL) ? -1 : pbpp->bpp_pbppNext->bpp_iIndex;
        CPrintF("Point's next important point: %d -> %d\n", iLastNext, iNewNext);
      }
    } break;

    // Invalid action
    default:
      if (bLocal) {
        CPrintF(" Invalid sandbox action: %d\n", iAction);
      }
  }
};
