#ifndef SE_INCL_COMM_H
#define SE_INCL_COMM_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <Engine/Network/Buffer.h>
#include <Engine/Base/Synchronization.h>
#include <Engine/Base/CTString.h>

#define SERVER_CLIENTS 16

// Communication class
class ENGINE_API Communication {
private:
  int dummy;
private:
  // client
  void Client_OpenLocal(void);
  void Client_OpenNet_t(ULONG ulServerAddress);
  void Client_CloseSockets(void);
  // update master UDP socket and route its messages
  BOOL UpdateUDPMaster(void);

public:
  Communication(SLONG slTCPSize, SLONG slUDPSize);
  ~Communication(void);

  // start/stop protocols
  void Init(void);
  void Close(void);

  void InitWinsock(void);
  void EndWinsock(void);
  void PrepareForUse(BOOL bUseNetwork, BOOL bClient);
  void Unprepare(void);
  BOOL IsNetworkEnabled(void);
  // get address of local machine
  void GetHostName(CTString &strName, CTString &strAddress);

  // broadcast communication
  void Broadcast_Send(const void *pvSend, SLONG slSendSize);
  BOOL Broadcast_Receive(void *pvReceive, SLONG &slReceiveSize);
  void Broadcast_Update(void);

  // Server
  void Server_Init_t(void);
  void Server_Close(void);

  void Server_FlushListener(void);
  void Server_Accept_t(void);
  BOOL GetLastAccepted(INDEX &iAccepted);

  void Server_ClearClient(INDEX iClient);
  BOOL Server_IsClientLocal(INDEX iClient);
  BOOL Server_IsClientUnused(INDEX iClient);
  BOOL Server_IsClientDisconnected(INDEX iClient);
  CTString Server_GetClientName(INDEX iClient);

  void Server_Send_Reliable(INDEX iClient, const void *pvSend, SLONG slSendSize);
  BOOL Server_Receive_Reliable(INDEX iClient, void *pvReceive, SLONG &slReceiveSize);
  void Server_Send_Unreliable(INDEX iClient, const void *pvSend, SLONG slSendSize);
  BOOL Server_Receive_Unreliable(INDEX iClient, void *pvReceive, SLONG &slReceiveSize);

  void Server_Update(void);

  // Client
  void Client_Init_t(char* strServerName);
  void Client_Init_t(ULONG ulServerAddress);
  void Client_Close(void);

  void Client_Clear(void);
  BOOL Client_IsDisconnected(void);

  void Client_Send_Reliable(const void *pvSend, SLONG slSendSize);
  BOOL Client_Receive_Reliable(void *pvReceive, SLONG &slReceiveSize);
  BOOL Client_Receive_Reliable(CTStream &strmReceive);
  void Client_PeekSize_Reliable(SLONG &slExpectedSize, SLONG &slReceivedSoFar);
  void Client_Send_Unreliable(const void *pvSend, SLONG slSendSize);
  BOOL Client_Receive_Unreliable(void *pvReceive, SLONG &slReceiveSize);

  void Client_Update(void);
};

ENGINE_API extern Communication comm;


#endif  /* include-once check. */

