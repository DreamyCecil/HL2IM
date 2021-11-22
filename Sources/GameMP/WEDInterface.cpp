#include "StdAfx.h"

extern CGame *_pGame;

extern INDEX gam_iQuickStartDifficulty;
extern INDEX gam_iQuickStartMode;
extern INDEX gam_iStartDifficulty;
extern INDEX gam_iStartMode;

// initialize game and load settings
void CGame::Initialize(const CTFileName &fnGameSettings)
{
  gm_fnSaveFileName = fnGameSettings;
  InitInternal();
}

// save settings and cleanup
void CGame::End(void)
{
  EndInternal();
}

// automaticaly manage input enable/disable toggling
static BOOL _bInputEnabled = FALSE;
void UpdateInputEnabledState(CViewPort *pvp)
{
  // input should be enabled if application is active
  // and no menu is active and no console is active
  BOOL bShouldBeEnabled = _pGame->gm_csConsoleState==CS_OFF && _pGame->gm_csComputerState==CS_OFF;

  // if should be turned off
  if (!bShouldBeEnabled && _bInputEnabled) {
    // disable it
    _pInput->DisableInput();

    // remember new state
    _bInputEnabled = FALSE;
  }

  // if should be turned on
  if (bShouldBeEnabled && !_bInputEnabled) {
    // enable it
    _pInput->EnableInput(pvp);

    // remember new state
    _bInputEnabled = TRUE;
  }
}

// automaticaly manage pause toggling
void UpdatePauseState(void)
{
  BOOL bShouldPause = 
     _pGame->gm_csConsoleState ==CS_ON || _pGame->gm_csConsoleState ==CS_TURNINGON || _pGame->gm_csConsoleState ==CS_TURNINGOFF ||
     _pGame->gm_csComputerState==CS_ON || _pGame->gm_csComputerState==CS_TURNINGON || _pGame->gm_csComputerState==CS_TURNINGOFF;

  _pNetwork->SetLocalPause(bShouldPause);
}

// run a quicktest game from within editor
void CGame::QuickTest(const CTFileName &fnMapName, 
  CDrawPort *pdp, CViewPort *pvp)
{
  UINT uiMessengerMsg = RegisterWindowMessageA("Croteam Messenger: Incoming Message");
  EnableLoadingHook(pdp);

  // quick start game with the world
  gm_strNetworkProvider = "Local";
  gm_aiStartLocalPlayers[0] = gm_iWEDSinglePlayer;
  gm_aiStartLocalPlayers[1] = -1;
  gm_aiStartLocalPlayers[2] = -1;
  gm_aiStartLocalPlayers[3] = -1;
  gm_CurrentSplitScreenCfg = CGame::SSC_PLAY1;

  // set properties for a quick start session
  CSessionProperties sp;
  SetQuickStartSession(sp);

  // start the game
  if( !NewGame( fnMapName, fnMapName, sp)) {
    DisableLoadingHook();
    return;
  }

  // enable input
  _pInput->EnableInput(pvp);

  // initialy, game is running
  BOOL bRunning = TRUE;
  // while it is still running
  while( bRunning)
  {
    // while there are any messages in the message queue
    MSG msg;
    while( PeekMessage( &msg, NULL, 0, 0, PM_REMOVE)) {
      // if it is not a mouse message
      if( !(msg.message>=WM_MOUSEFIRST && msg.message<=WM_MOUSELAST)) {
        // if not system key messages
        if( !(msg.message==WM_KEYDOWN && msg.wParam==VK_F10
            ||msg.message==WM_SYSKEYDOWN)) {
          // dispatch it
          TranslateMessage(&msg);
        }
        // if paint message
        if( msg.message==WM_PAINT) {
          // dispatch it
          DispatchMessage(&msg);
        }
      }

      // if should stop
      if ((msg.message==WM_QUIT)
        ||(msg.message==WM_CLOSE)
        ||(msg.message==WM_KEYDOWN && msg.wParam==VK_ESCAPE)
        ||(msg.message==WM_ACTIVATE)
        ||(msg.message==WM_CANCELMODE)
        ||(msg.message==WM_KILLFOCUS)
        ||(msg.message==WM_ACTIVATEAPP)) {
        // stop running
        bRunning = FALSE;
        break;
      }

      if (msg.message==uiMessengerMsg)
      {
        if(!_pNetwork->IsPaused()) 
        {
          // pause it
          _pNetwork->TogglePause();
        }
        char *pachrTemp=getenv("TEMP");
        if( pachrTemp!=NULL)
        {
          FILE *pfileMessage=fopen(CTString(pachrTemp)+"Messenger.msg","r");
          if( pfileMessage!=NULL)
          {
            char achrMessage[1024];
            char *pachrMessage=fgets( achrMessage, 1024-1, pfileMessage);
            if( pachrMessage!=NULL)
            {
              CPrintF("%s",pachrMessage);
            }
          }
        }
      }

      // if pause pressed
      if (msg.message==WM_KEYDOWN && msg.wParam==VK_PAUSE && 
        _pGame->gm_csConsoleState==CS_OFF && _pGame->gm_csComputerState==CS_OFF) {
        // toggle pause
        _pNetwork->TogglePause();
      }
      if(msg.message==WM_KEYDOWN && 
        (MapVirtualKey(msg.wParam, 0)==41 // scan code for '~'
        ||msg.wParam==VK_F1)) {
        if (_pGame->gm_csConsoleState==CS_OFF || _pGame->gm_csConsoleState==CS_TURNINGOFF) {
          _pGame->gm_csConsoleState = CS_TURNINGON;
        } else {
          _pGame->gm_csConsoleState = CS_TURNINGOFF;
        }
      }
      extern INDEX con_bTalk;
      if (con_bTalk && _pGame->gm_csConsoleState==CS_OFF) {
        con_bTalk = FALSE;
        _pGame->gm_csConsoleState = CS_TALK;
      }
      if (msg.message==WM_KEYDOWN) {
        ConsoleKeyDown(msg);
        if (_pGame->gm_csConsoleState!=CS_ON) {
          ComputerKeyDown(msg);
        }
      } else if (msg.message==WM_KEYUP) {
        // special handler for talk (not to invoke return key bind)
        if( msg.wParam==VK_RETURN && _pGame->gm_csConsoleState==CS_TALK) _pGame->gm_csConsoleState = CS_OFF;
      } else if (msg.message==WM_CHAR) {
        ConsoleChar(msg);
      }
      if (msg.message==WM_LBUTTONDOWN
        ||msg.message==WM_RBUTTONDOWN
        ||msg.message==WM_LBUTTONDBLCLK
        ||msg.message==WM_RBUTTONDBLCLK
        ||msg.message==WM_LBUTTONUP
        ||msg.message==WM_RBUTTONUP) {
        if (_pGame->gm_csConsoleState!=CS_ON) {
          ComputerKeyDown(msg);
        }
      }
    }

    // get real cursor position
    if (_pGame->gm_csComputerState != CS_OFF) {
      POINT pt;
      ::GetCursorPos(&pt);
      ::ScreenToClient(pvp->vp_hWnd, &pt);
      ComputerMouseMove(pt.x, pt.y);
    }
    UpdatePauseState();
    UpdateInputEnabledState(pvp);
      
    // if playing a demo and it is finished
    if (_pNetwork->IsDemoPlayFinished()) {
      // stop running
      bRunning = FALSE;
    }

    // do the main game loop
    GameMainLoop();
    
    // redraw the view
    if (pdp->Lock()) {
      // if current view preferences will not clear the background, clear it here
      if( _wrpWorldRenderPrefs.GetPolygonsFillType() == CWorldRenderPrefs::FT_NONE) {
        // clear background
        pdp->Fill(C_BLACK| CT_OPAQUE);
        pdp->FillZBuffer(ZBUF_BACK);
      }
      // redraw view
      if (_pGame->gm_csComputerState != CS_ON) {
        GameRedrawView(pdp, (_pGame->gm_csConsoleState==CS_ON)?0:GRV_SHOWEXTRAS);
      }
      ComputerRender(pdp);
      ConsoleRender(pdp);
      pdp->Unlock();
      // show it
      pvp->SwapBuffers();
    }
  }

  if (_pGame->gm_csConsoleState != CS_OFF) {
    _pGame->gm_csConsoleState = CS_TURNINGOFF;
  }
  if (_pGame->gm_csComputerState != CS_OFF) {
    _pGame->gm_csComputerState = CS_TURNINGOFF;
    cmp_ppenPlayer = NULL;
  }

  _pInput->DisableInput();
  StopGame();
  DisableLoadingHook();
}
