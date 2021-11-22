#ifndef SE_INCL_MESSAGEDISPATCHER_H
#define SE_INCL_MESSAGEDISPATCHER_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <Engine/Base/CTString.h>
#include <Engine/Base/Lists.h>

/*
 * Network provider description.
 */
class ENGINE_API CNetworkProvider {
public:
  CTString np_Description;    // description string of the driver
public:
  CListNode np_Node;						   // for linking in list of avaliable providers

  /* Default constructor. */
  CNetworkProvider(void);

  /* Create a human description of driver. */
  const CTString &GetDescription(void) const;
};

/*
 * Message dispatcher object for sending/receiving messages.
 *
 *  NOTE: message buffer is handled thread-locally
 *  (only one CMessageDispatcher object pre process is allowed)
 */
class ENGINE_API CMessageDispatcher {
public:
  CListHead md_lhProviders;           // statical list of providers initialized at startup
  CTString md_strGameID;

  /* Enumerate all providers at startup (later enumeration just copies this list). */
  void EnumNetworkProviders_startup(CListHead &lh);
public:
  /* Default constructor. */
  CMessageDispatcher(void);
  /* Destructor. */
  ~CMessageDispatcher(void);

  /* Initialize for a given game. */
  void Init(const CTString &strGameID);

  /* Enumerate all providers. */
  void EnumNetworkProviders(CListHead &lh);
  /* Start using a service provider. */
  void StartProvider_t(const CNetworkProvider &npProvider);
  /* Stop using current service provider. */
  void StopProvider(void);

  /* Send a message from server to client. */
  void SendToClient(INDEX iClient, const CNetworkMessage &nmMessage);
  void SendToClientReliable(INDEX iClient, const CNetworkMessage &nmMessage);
  void SendToClientReliable(INDEX iClient, CTMemoryStream &strmMessage);
  /* Send a message from client to server. */
  void SendToServer(const CNetworkMessage &nmMessage);
  void SendToServerReliable(const CNetworkMessage &nmMessage);
  /* Receive next message from client to server. */
  BOOL ReceiveFromClient(INDEX iClient, CNetworkMessage &nmMessage);
  BOOL ReceiveFromClientReliable(INDEX iClient, CNetworkMessage &nmMessage);
  /* Receive next message from server to client. */
  BOOL ReceiveFromServer(CNetworkMessage &nmMessage);
  BOOL ReceiveFromServerReliable(CNetworkMessage &nmMessage);
  BOOL ReceiveFromServerReliable(CTMemoryStream &strmMessage);
  /* Send/receive broadcast messages. */
  void SendBroadcast(const CNetworkMessage &nmMessage, ULONG ulAddr, UWORD uwPort);
  BOOL ReceiveBroadcast(CNetworkMessage &nmMessage, ULONG &ulAddr, UWORD &uwPort);
};


#endif  /* include-once check. */

