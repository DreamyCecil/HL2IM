#ifndef SE_INCL_GAMESPY_H
#define SE_INCL_GAMESPY_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

// called when server starts
void GameSpy_ServerInit(void);
// called when server stops
void GameSpy_ServerEnd(void);
// called each tick
void GameSpy_ServerHandle(void);
// called to notify that something has changed
void GameSpy_ServerStateChanged(void);

// initialize server enumeration support
void GameSpy_EnumInit(void);
// start enumerating
void GameSpy_EnumTrigger(BOOL bInternet);
// called each tick
void GameSpy_EnumHandle(void);
// cancel any eventual pending enumeration
void GameSpy_EnumCancel(void);
// cleanup server enumeration support
void GameSpy_EnumEnd(void);


#endif  /* include-once check. */

