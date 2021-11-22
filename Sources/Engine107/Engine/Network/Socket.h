#ifndef SE_INCL_SOCKET_H
#define SE_INCL_SOCKET_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <Engine/Network/Buffer.h>

class CTSocketAdr {
public:
  ULONG sa_ulAddress;   // host address
  UWORD sa_uwPort;      // host port
  UWORD sa_uwID;        // host id
  void MakeBroadcast(void);
  void Clear(void) {
    sa_ulAddress = 0;
    sa_uwPort = 0;
    sa_uwID = 0;
  }
};

class CTSocket {
public:
// implementation:
  BOOL so_bSocketOpen;  // set if socket is open and working
  CBlockBuffer so_bbSend;  // outgoing buffer
  CBlockBuffer so_bbRecv;  // incoming buffer
  BOOL so_bReliable;    // set for reliable sockets
  BOOL so_bLocal;       // set for local sockets
  BOOL so_bListener;    // set for connection-accepting sockets
  BOOL so_bBound;       // set for udp sockets that have been explicitly or implicitly bound

  SOCKET so_hSocket; // the socket handle itself for non-local sockets
  CTSocket *so_psoOther;  // other-side socket for local sockets

  // create an inet-family socket
  void CreateSocket_t(BOOL bTCP);
  // bind socket to the given address
  void Bind_t(ULONG ulLocalHost, ULONG ulLocalPort);
  // connect socket to the given address
  void Connect_t(ULONG ulHost, ULONG ulPort);
  // set socket to non-blocking mode
  void SetNonBlocking_t(void);
  // enable broadcast for socket
  void SetBroadcast_t(void);
  // report socket info to console
  void ReportInfo(void);
  // get generic socket error info string an last error
  CTString GetSocketError(INDEX iError);

// interface:
  CTSocket(void);
  ~CTSocket(void);
  void Clear(void);
  // check whether the socket is open
  BOOL IsOpen(void);

  // open a listener socket
  void OpenListener_t(ULONG ulLocalHost, ULONG ulLocalPort);
  // accept a client via another listener socket
  // -- returns false if no connection pending
  BOOL OpenTCP_Accept_t(CTSocket &soListener);
  // connect to a server via TCP
  void OpenTCP_Connect_t(ULONG ulHost, ULONG ulPort);
  // open an UDP socket at given port and connect to given server and port
  void OpenUDP_t(ULONG ulLocalHost, ULONG ulLocalPort);
  // open a local socket and optionally connect to another local socket
  void OpenLocal(BOOL bReliable, CTSocket *psoOther);

  // get address of this host
  void GetLocalAddress_t(ULONG &ulHost, ULONG &ulPort);
  // get address of the peer host connected to this socket
  void GetRemoteAddress_t(ULONG &ulHost, ULONG &ulPort);

  // send data through the socket
  void Send(const void *pvSend, SLONG slSize);
  void SendTo(const void *pvSend, SLONG slSize, const CTSocketAdr &saAdr);
  // receive data from the socket
  BOOL Receive(void *pvReceive, SLONG &slSize);
  BOOL ReceiveFrom(void *pvReceive, SLONG slSize, CTSocketAdr &saAdr);
  BOOL Receive(CTStream &strmReceive);

  // update socket buffers (send/receive data)
  // -- returns true if maybe something more to do
  BOOL UpdateBuffers(void);

  // update socket outgoing buffer by copying to a master socket
  BOOL SynchronizeOutgoing(CTSocket &soMaster, CTSocketAdr &saDestAdr);
};

// convert string address to a number
ENGINE_API extern ULONG StringToAddress(const CTString &strAddress);
// convert address to a printable string
ENGINE_API extern CTString AddressToString(ULONG ulHost);


#endif  /* include-once check. */

