/* Copyright (c) 2021 Dreamy Cecil
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
#include "ServerIntegration.h"
#include "EntitiesMP/Player.h"

#include "Bots/Patcher/patcher.h"

// Server patches
class CCecilMessageDispatcher : public CMessageDispatcher {
  public:
    // CServer::Handle alternative
	  BOOL ServerHandle(INDEX iClient, CNetworkMessage &nmReceived);
		
	  BOOL P_ReceiveFromClient(INDEX iClient, CNetworkMessage &nmMessage);
	  BOOL P_ReceiveFromClientReliable(INDEX iClient, CNetworkMessage &nmMessage);
};

// Client patches
class CCecilSessionState : public CSessionState {
  public:
    void P_ProcessGameStreamBlock(CNetworkMessage &nmMessage);
};

// Player character serialization into network packets
CNetworkMessage &operator>>(CNetworkMessage &nm, CPlayerCharacter &pc) {
  nm >> pc.pc_strName >> pc.pc_strTeam;
  nm.Read(pc.pc_aubGUID, PLAYERGUIDSIZE);
  nm.Read(pc.pc_aubAppearance, MAX_PLAYERAPPEARANCE);

  return nm;
};

CNetworkMessage &operator<<(CNetworkMessage &nm, CPlayerCharacter &pc) {
  nm << pc.pc_strName;
  nm << pc.pc_strTeam;
  nm.Write(pc.pc_aubGUID, PLAYERGUIDSIZE);
  nm.Write(pc.pc_aubAppearance, MAX_PLAYERAPPEARANCE);

  return nm;
};

// Add a block to streams for all sessions
void CECIL_AddBlockToAllSessions(CCecilStreamBlock &nsb) {
  CServer &srv = _pNetwork->ga_srvServer;

  // for each active session
  for (INDEX iSession = 0; iSession < srv.srv_assoSessions.Count(); iSession++) {
    CSessionSocket &sso = srv.srv_assoSessions[iSession];

    if (iSession > 0 && !sso.sso_bActive) {
      continue;
    }

    // add the block to the buffer
    ((CCecilNetworkStream &)sso.sso_nsBuffer).AddBlock(nsb);
  }
};

// Original function pointer
typedef void (CSessionState::*CProcGameStreamBlockFunc)(CNetworkMessage &);
static CProcGameStreamBlockFunc pProcGameStreamBlock = NULL;

// Patch some networking functions
extern void CECIL_ApplyNetworkPatches(void) {
	// receive messages from the client
	BOOL (CMessageDispatcher::*pRecFromClient)(INDEX, CNetworkMessage &) = &CMessageDispatcher::ReceiveFromClient;
	CPatch *pPatchRFC = new CPatch(pRecFromClient, &CCecilMessageDispatcher::P_ReceiveFromClient, true, true);
	
	BOOL (CMessageDispatcher::*pRecFromClientReliable)(INDEX, CNetworkMessage &) = &CMessageDispatcher::ReceiveFromClientReliable;
	CPatch *pPatchRFCR = new CPatch(pRecFromClientReliable, &CCecilMessageDispatcher::P_ReceiveFromClientReliable, true, true);

  // receive messages from the server
	pProcGameStreamBlock = &CSessionState::ProcessGameStreamBlock;
	CPatch *pPatchPGSB = new CPatch(pProcGameStreamBlock, &CCecilSessionState::P_ProcessGameStreamBlock, true, true);
};

// Server receives a packet
BOOL CCecilMessageDispatcher::P_ReceiveFromClient(INDEX iClient, CNetworkMessage &nmMessage) {
  // receive message in static buffer
  nmMessage.nm_slSize = nmMessage.nm_slMaxSize;
  BOOL bReceived = _cmiComm.Server_Receive_Unreliable(iClient, (void *)nmMessage.nm_pubMessage, nmMessage.nm_slSize);

  // if there is message
  if (bReceived) {
    // init the message structure
    nmMessage.nm_pubPointer = nmMessage.nm_pubMessage;
    nmMessage.nm_iBit = 0;

    UBYTE ubType;
    nmMessage.Read(&ubType, sizeof(ubType));
    nmMessage.nm_mtType = (MESSAGETYPE)ubType;
		
    // replace default CServer processor or return TRUE
    // if have to process through the original function
    return ServerHandle(iClient, nmMessage);
  }

  return bReceived;
};

// Server receives a reliable packet
BOOL CCecilMessageDispatcher::P_ReceiveFromClientReliable(INDEX iClient, CNetworkMessage &nmMessage) {
	// receive message in static buffer
	nmMessage.nm_slSize = nmMessage.nm_slMaxSize;
	BOOL bReceived = _cmiComm.Server_Receive_Reliable(iClient, (void *)nmMessage.nm_pubMessage, nmMessage.nm_slSize);

	// if there is a message
	if (bReceived) {
		// init the message structure
		nmMessage.nm_pubPointer = nmMessage.nm_pubMessage;
		nmMessage.nm_iBit = 0;

		UBYTE ubType;
		nmMessage.Read(&ubType, sizeof(ubType));
		nmMessage.nm_mtType = (MESSAGETYPE)ubType;
		
    // replace default CServer processor or return TRUE
    // if have to process through the original function
		return ServerHandle(iClient, nmMessage);
	}

	return bReceived;
};

// Server processes received packet from a client
BOOL CCecilMessageDispatcher::ServerHandle(INDEX iClient, CNetworkMessage &nmReceived) {
  CServer &srv = _pNetwork->ga_srvServer;

	switch (nmReceived.nm_mtType) {
    // [Cecil] Sandbox actions
		case MSG_CECIL_SANDBOX: {
      // forward the packet to all clients
      CCecilStreamBlock nsb(nmReceived, ++srv.srv_iLastProcessedSequence);
      
      CECIL_AddBlockToAllSessions(nsb);
    } return FALSE;
	}

  // let original CServer::Handle process other packets
	return TRUE;
};

// Client processes received packet from the server
void CCecilSessionState::P_ProcessGameStreamBlock(CNetworkMessage &nmMessage) {
  // copy the tick to process into tick used for all tasks
  _pTimer->SetCurrentTick(ses_tmLastProcessedTick);

  switch (nmMessage.GetType()) {
    // [Cecil] Sandbox actions
    case MSG_CECIL_SANDBOX: {
      INDEX iPlayer, iAdmin, iAction;
      nmMessage >> iPlayer >> iAdmin >> iAction;

      CPlayer *pen = NULL;
      
      if (iPlayer != -1) {
        pen = (CPlayer *)CEntity::GetPlayerEntity(iPlayer);
      }

      // perform sandbox action
      CECIL_SandboxAction(pen, iAction, iAdmin, nmMessage);
    } break;

    // call the original function for standard packets
    default: (this->*pProcGameStreamBlock)(nmMessage);
  }
};
