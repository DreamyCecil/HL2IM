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

#pragma once

// [Cecil] TEMP 2021-06-20: Bot thoughts
struct SBotThoughts {
  CTString strThoughts[16]; // thoughts

  // Constructor
  SBotThoughts(void) {
    for (INDEX i = 0; i < 16; i++) {
      strThoughts[i] = "";
    }
  };

  // Push new thought
  void Push(const CTString &str) {
    for (INDEX i = 15; i > 0; i--) {
      strThoughts[i] = strThoughts[i-1];
    }

    strThoughts[0] = CTString(0, "[%s] %s", TimeToString(_pTimer->CurrentTick()), str);
  }
};

// [Cecil] 2021-06-11: Player bot
#include "EntitiesMP/Player.h"
#include "EntitiesMP/BotMod/PlayerBot.h"

// [Cecil] 2019-05-28: NavMesh commands
extern INDEX MOD_iRenderNavMesh;
extern INDEX MOD_iNavMeshPoint;
extern INDEX MOD_iNavMeshConnecting;

// [Cecil] 2021-06-11: List of bot entities
DECL_DLL extern CDynamicContainer<CPlayerBot> _cenPlayerBots;

// [Cecil] 2019-06-01: Initialize the bot mod
DECL_DLL void CECIL_InitBotMod(void);

// [Cecil] 2021-06-13: End the bot mod
DECL_DLL void CECIL_EndBotMod(void);

// [Cecil] 2021-06-13: Bot game start
DECL_DLL void CECIL_BotGameStart(CSessionProperties &sp);

// [Cecil] 2021-06-12: Bot game cleanup
DECL_DLL void CECIL_BotGameCleanup(void);

// [Cecil] Render extras on top of the world
void CECIL_WorldOverlayRender(CPlayer *penOwner, CEntity *penViewer, CAnyProjection3D &apr, CDrawPort *pdp);
// [Cecil] Render extras on top of the HUD
void CECIL_HUDOverlayRender(CPlayer *penOwner, CEntity *penViewer, CAnyProjection3D &apr, CDrawPort *pdp);
