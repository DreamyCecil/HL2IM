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
#include "BotModMain.h"
#include "BotFunctions.h"

// [Cecil] 2019-05-28: NavMesh Commands
extern INDEX MOD_iRenderNavMesh = 0; // NavMesh render mode (0 - disabled, 1 - points, 2 - connections, 3 - IDs, 4 - flags)
extern INDEX MOD_iNavMeshPoint = -1; // currently selected NavMesh point
extern INDEX MOD_iNavMeshConnecting = 0; // connecting mode (0 - disabled, 1 - to point, 2 - to each other, 3 - others to this one)

extern INDEX MOD_bEntityIDs;
extern INDEX MOD_bBotThoughts;

// [Cecil] 2021-06-11: List of bot entities
extern CDynamicContainer<CPlayerBot> _cenPlayerBots = CDynamicContainer<CPlayerBot>();

// [Cecil] 2021-06-12: Initialized bot mod
static BOOL _bBotModInit = FALSE;

// [Cecil] 2019-06-01: Initialize the bot mod
void CECIL_InitBotMod(void) {
  // mark as initialized
  if (_bBotModInit) {
    return;
  }

  _bBotModInit = TRUE;

  // [Cecil] 2021-06-12: Create Bot NavMesh
  _pNavmesh = new CBotNavmesh();

  // [Cecil] 2021-06-11: Apply networking patch
  extern void CECIL_ApplyNetworkPatches(void);
  CECIL_ApplyNetworkPatches();

  // [Cecil] 2021-06-23: Initialize sandbox actions
  extern void CECIL_InitSandboxActions(void);
  CECIL_InitSandboxActions();
};

// [Cecil] 2021-06-13: End the bot mod
void CECIL_EndBotMod(void) {
  // [Cecil] 2021-06-12: Destroy Bot NavMesh
  if (_pNavmesh != NULL) {
    delete _pNavmesh;
    _pNavmesh = NULL;
  }
};

// [Cecil] 2021-06-13: Bot game start
void CECIL_BotGameStart(CSessionProperties &sp) {
  CWorld &wo = _pNetwork->ga_World;

  // [Cecil] 2021-06-12: Global bot mod entity
  CPlacement3D plEntity(FLOAT3D(0.0f, 0.0f, 0.0f), ANGLE3D(0.0f, 0.0f, 0.0f));
  CEntity *penNew = wo.CreateEntity_t(plEntity, CTFILENAME("Classes\\BotModGlobal.ecl"));
  penNew->Initialize();

  // [Cecil] 2021-06-13: Load NavMesh for a map
  try {
    _pNavmesh->Load(wo);

  } catch (char *strError) {
    (void)strError;
  }
};

// [Cecil] 2021-06-12: Bot game cleanup
void CECIL_BotGameCleanup(void) {
  // [Cecil] 2018-10-23: Clear the NavMesh
  _pNavmesh->ClearNavMesh();

  // [Cecil] 2021-06-12: Clear bot list
  _cenPlayerBots.Clear();
};

// [Cecil] Render extras on top of the world
void CECIL_WorldOverlayRender(CPlayer *penOwner, CEntity *penViewer, CAnyProjection3D &apr, CDrawPort *pdp) {
  // not a server
  if (!_pNetwork->IsServer() && !_pNetwork->IsPlayingDemo()) {
    return;
  }

  CPerspectiveProjection3D &prProjection = *(CPerspectiveProjection3D *)(CProjection3D *)apr;
  prProjection.Prepare();

  pdp->SetFont(_pfdConsoleFont);
  pdp->SetTextScaling(1.0f);

  // NavMesh rendering
  if (MOD_iRenderNavMesh > 0) {
    if (_pNavmesh->bnm_cbppPoints.Count() > 0)
    {
      const BOOL bConnections = (MOD_iRenderNavMesh > 1);
      const BOOL bIDs = (MOD_iRenderNavMesh > 2);
      const BOOL bFlags = (MOD_iRenderNavMesh > 3);

      const CBotPathPoint *pbppClosest = NULL;
      
      // bots don't need to select points
      if (!penOwner->IsBot()) {
        pbppClosest = NearestNavMeshPointPos(penOwner, penOwner->GetPlayerWeapons()->m_vRayHit);
      }

      FOREACHINDYNAMICCONTAINER(_pNavmesh->bnm_cbppPoints, CBotPathPoint, itbpp) {
        CBotPathPoint *pbpp = itbpp;
        INDEX iPointID = pbpp->bpp_iIndex;
        
        FLOAT3D vPointOnScreen;
        FLOAT3D vPoint1 = pbpp->bpp_vPos;
        prProjection.ProjectCoordinate(pbpp->bpp_vPos, vPointOnScreen);

        if (vPointOnScreen(3) > 0.0f) {
          continue;
        }

        vPointOnScreen(2) = -vPointOnScreen(2) + pdp->GetHeight();

        // highlight closest point for selection
        BOOL bClosestPoint = (pbppClosest == pbpp);
        CBotPathPoint *pbppSelected = _pNavmesh->FindPointByID(MOD_iNavMeshPoint);

        // range and connections
        if (bConnections) {
          // range
          for (INDEX iRange = 0; iRange < 3; iRange++) {
            FLOAT3D vRangeDir = FLOAT3D(CosFast(iRange * 60.0f), 0.0f, SinFast(iRange * 60.0f)) * pbpp->bpp_fRange;
            
            FLOAT3D vRangeEnd1, vRangeEnd2;
            prProjection.ProjectCoordinate(vPoint1 + vRangeDir, vRangeEnd1);
            prProjection.ProjectCoordinate(vPoint1 - vRangeDir, vRangeEnd2);

            if (vRangeEnd1(3) > 0.0f || vRangeEnd2(3) > 0.0f) {
              continue;
            }

            // range is too small for rendering
            if ((vRangeEnd1 - vRangeEnd2).Length() < 12.0f) {
              continue;
            }
            
            vRangeEnd1(2) = -vRangeEnd1(2) + pdp->GetHeight();
            vRangeEnd2(2) = -vRangeEnd2(2) + pdp->GetHeight();

            pdp->DrawLine(vRangeEnd1(1), vRangeEnd1(2), vRangeEnd2(1), vRangeEnd2(2), 0x00FFFF9F);
          }

          // connections
          INDEX ctTargets = 0;

          {FOREACHINDYNAMICCONTAINER(pbpp->bpp_cbppPoints, CBotPathPoint, itbppT) {
            CBotPathPoint *pbppT = itbppT;
            ctTargets++;
          
            FLOAT3D vOnScreen1, vOnScreen2;
            FLOAT3D vPoint2 = pbppT->bpp_vPos;
          
            if (ProjectLine(&prProjection, vPoint1, vPoint2, vOnScreen1, vOnScreen2)) {
              pdp->DrawLine(vOnScreen1(1), vOnScreen1(2), vOnScreen2(1), vOnScreen2(2), C_ORANGE|0x7F);
            }
          }}

          // connect with important entity
          if (pbpp->bpp_penImportant != NULL) {
            CEntity *penImportant = pbpp->bpp_penImportant;
            FLOAT3D vEntity = penImportant->GetPlacement().pl_PositionVector;

            if (penImportant != NULL) {
              FLOAT3D vOnScreen1, vEntityOnScreen;

              if (ProjectLine(&prProjection, vPoint1, vEntity, vOnScreen1, vEntityOnScreen)) {
                pdp->DrawLine(vOnScreen1(1), vOnScreen1(2), vEntityOnScreen(1), vEntityOnScreen(2), 0x00FF00FF);
              }
            }
          }

          // connect with next important point
          if (pbpp->bpp_pbppNext != NULL) {
            FLOAT3D vOnScreen1, vNextPointOnScreen;

            if (ProjectLine(&prProjection, vPoint1, pbpp->bpp_pbppNext->bpp_vPos, vOnScreen1, vNextPointOnScreen)) {
              pdp->DrawLine(vOnScreen1(1), vOnScreen1(2), vNextPointOnScreen(1), vNextPointOnScreen(2), 0x0000FFFF);
            }
          }
        }
        
        // selected point
        if (pbppSelected == pbpp) {
          pdp->DrawPoint(vPointOnScreen(1), vPointOnScreen(2), 0xFF0000FF, 10);

        // point for selection
        } else if (bClosestPoint) {
          pdp->DrawPoint(vPointOnScreen(1), vPointOnScreen(2), 0x009900FF, 10);

        // normal point
        } else {
          pdp->DrawPoint(vPointOnScreen(1), vPointOnScreen(2), 0xFFFF00FF, 5);
        }

        // point IDs
        if (bIDs) {
          CTString strPoint;
          strPoint.PrintF("ID: %d", iPointID);

          // point flags
          if (bFlags) {
            #define POINT_DESC(_Type) strPoint += ((pbpp->bpp_ulFlags & PPF_##_Type) ? "\n " #_Type : "")

            POINT_DESC(WALK);
            POINT_DESC(JUMP);
            POINT_DESC(CROUCH);
            POINT_DESC(OVERRIDE);
            POINT_DESC(UNREACHABLE);
            POINT_DESC(TELEPORT);

            #undef POINT_DESC
          }

          pdp->PutTextC(strPoint, vPointOnScreen(1), vPointOnScreen(2) + 16, 0xFFFFFFFF);
        }
      }
    }

    // [Cecil] 2019-06-04: Render bots' target points
    for (INDEX iBot = 0; iBot < _cenPlayerBots.Count(); iBot++) {
      CPlayerBot *penBot = _cenPlayerBots.Pointer(iBot);

      if (!ASSERT_ENTITY(penBot)) {
        continue;
      }
      
      FLOAT3D vPos1, vPos2;
      FLOAT3D vBot = penBot->GetLerpedPlacement().pl_PositionVector;
      FLOAT3D vCurPoint = FLOAT3D(0.0f, 0.0f, 0.0f);

      // current point
      if (penBot->m_pbppCurrent != NULL) {
        vCurPoint = penBot->m_pbppCurrent->bpp_vPos;

        if (ProjectLine(&prProjection, vBot, vCurPoint, vPos1, vPos2)) {
          pdp->DrawLine(vPos1(1), vPos1(2), vPos2(1), vPos2(2), 0xFFFF00FF);
        }
      }

      // target point
      if (penBot->m_pbppTarget != NULL) {
        vCurPoint = penBot->m_pbppTarget->bpp_vPos;
          
        if (ProjectLine(&prProjection, vBot, vCurPoint, vPos1, vPos2)) {
          pdp->DrawLine(vPos1(1), vPos1(2), vPos2(1), vPos2(2), 0xFF0000FF);
        }
      }
    }
  }

  // render entity IDs
  if (MOD_bEntityIDs) {
    FOREACHINDYNAMICCONTAINER(_pNetwork->ga_World.wo_cenEntities, CEntity, iten) {
      CEntity *pen = iten;

      FLOAT fDist = (penViewer->GetPlacement().pl_PositionVector - pen->GetLerpedPlacement().pl_PositionVector).Length();

      // don't render IDs from the whole map
      if (fDist > 192.0f) {
        continue;
      }
      
      FLOAT3D vEntityID;
      prProjection.ProjectCoordinate(pen->GetLerpedPlacement().pl_PositionVector, vEntityID);

      if (vEntityID(3) >= 0.0f) {
        continue;
      }

      FLOAT fAlpha = 1.0f - Clamp((fDist - 16.0f) / 16.0f, 0.0f, 0.8f);
      UBYTE ubAlpha = NormFloatToByte(fAlpha);

      CTString strID;
      strID.PrintF("%d (%s)", pen->en_ulID, pen->en_pecClass->ec_pdecDLLClass->dec_strName);
      pdp->PutTextCXY(strID, vEntityID(1), -vEntityID(2)+pdp->GetHeight(), 0xBBD1EB00|ubAlpha);
    }
  }
};

// [Cecil] Render extras on top of the HUD
void CECIL_HUDOverlayRender(CPlayer *penOwner, CEntity *penViewer, CAnyProjection3D &apr, CDrawPort *pdp) {
  FLOAT fScaling = (FLOAT)pdp->GetHeight() / 480.0f;

  // not a server
  if (!_pNetwork->IsServer() && !_pNetwork->IsPlayingDemo()) {
    return;
  }

  // [Cecil] TEMP 2021-06-20: Bot thoughts
  if (MOD_bBotThoughts && penOwner->IsBot()) {
    pdp->SetFont(_pfdDisplayFont);
    pdp->SetTextScaling(fScaling);
    pdp->SetTextAspect(1.0f);

    CPlayerBot *penBot = (CPlayerBot *)penOwner;
    
    PIX pixX = 16 * fScaling;
    PIX pixY = 56 * fScaling;
    PIX pixThought = 18 * fScaling;

    for (INDEX iThought = 0; iThought < 16; iThought++) {
      UBYTE ubAlpha = NormFloatToByte(1.0f - iThought / 50.0f);
      COLOR colText = LerpColor(0xFFFFFF00, 0x7F7F7F00, iThought / 15.0f) | ubAlpha;

      pdp->PutText(penBot->m_btThoughts.strThoughts[iThought], pixX, pixY + iThought*pixThought, colText);
    }

    // target point
    if (penBot->m_pbppCurrent != NULL) {
      CTString strTarget(0, "Current Point: ^cffff00%d^r\nTarget Point: ^cff0000%d ^caf3f3f%s", penBot->m_pbppCurrent->bpp_iIndex,
                         penBot->m_pbppTarget->bpp_iIndex, penBot->m_bImportantPoint ? "(Important)" : "");
      pdp->PutText(strTarget, pixX, pixY + pixThought*17, 0xCCCCCCFF);
    }

    CTString strTime(0, "Cur Time: %.2f\nShooting: %.2f", _pTimer->CurrentTick(), penBot->m_tmShootTime);
    pdp->PutText(strTime, pixX, pixY + pixThought*19, 0xCCCCCCFF);
  }
};
