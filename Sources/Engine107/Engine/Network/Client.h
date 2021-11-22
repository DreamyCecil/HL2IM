#ifndef SE_INCL_CLIENT_H
#define SE_INCL_CLIENT_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include "EMsgBuffer.h"


class CClient {
public:

  FILE *cli_fDumpFile;

  CEMsgBuffer     cli_embReceiveBuffer;
  CEntityMessage  cli_emEntityMessage;
  INDEX           cli_iID;
  float           cli_fLastTickTime;

  ULONG cli_ulMsgId;

  CClient(){cli_ulMsgId = 0;cli_fLastTickTime=-1;};
  void AssignDumpFile(FILE* fp);
  void AssignID(INDEX iID);

  void SendMessage();
  int  ReceiveMessage();
  void ReceiveTick();
  void SendAcknowledge(float fTickTime);

  void ClientNetProcess();
};


#endif