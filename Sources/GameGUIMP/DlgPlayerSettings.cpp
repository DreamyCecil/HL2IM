// DlgPlayerSettings.cpp : implementation file
//

#include "stdafx.h"

#ifdef _DEBUG
#undef new
#define new DEBUG_NEW
#undef THIS_FILE
static char THIS_FILE[] = __FILE__;
#endif

/////////////////////////////////////////////////////////////////////////////
// CDlgPlayerSettings dialog



CDlgPlayerSettings::CDlgPlayerSettings(CWnd* pParent /*=NULL*/)
	: CDialog(CDlgPlayerSettings::IDD, pParent)
{
	//{{AFX_DATA_INIT(CDlgPlayerSettings)
	//}}AFX_DATA_INIT
}


void CDlgPlayerSettings::DoDataExchange(CDataExchange* pDX)
{
	CDialog::DoDataExchange(pDX);
	//{{AFX_DATA_MAP(CDlgPlayerSettings)
	DDX_Control(pDX, IDC_AVAILABLE_CONTROLS, m_listAvailableControls);
	DDX_Control(pDX, IDC_AVAILABLE_PLAYERS, m_listAvailablePlayers);
	//}}AFX_DATA_MAP
  
  // if dialog is giving data
  if( pDX->m_bSaveAndValidate != FALSE)
  {
    // get selected player
    INDEX iSelectedPlayer = m_listAvailablePlayers.GetCurSel();
    ASSERT( iSelectedPlayer != LB_ERR);
    // remember selected player
    _pGame->gm_iWEDSinglePlayer = iSelectedPlayer;

    // get selected controls
    INDEX iSelectedControls = m_listAvailableControls.GetCurSel();
    ASSERT( iSelectedControls != LB_ERR);
    // remember selected controls
//    _pGame->gm_apiPlayerInfo[iSelectedPlayer].pi_iControls = iSelectedControls;
  }
}


BEGIN_MESSAGE_MAP(CDlgPlayerSettings, CDialog)
	//{{AFX_MSG_MAP(CDlgPlayerSettings)
	ON_BN_CLICKED(IDC_PLAYER_APPEARANCE, OnPlayerAppearance)
	ON_BN_CLICKED(IDC_EDIT_CONTROLS, OnEditControls)
	ON_BN_CLICKED(IDC_RENAME_CONTROLS, OnRenameControls)
	ON_BN_CLICKED(IDC_RENAME_PLAYER, OnRenamePlayer)
	//}}AFX_MSG_MAP
END_MESSAGE_MAP()

/////////////////////////////////////////////////////////////////////////////
// CDlgPlayerSettings message handlers

void CDlgPlayerSettings::OnPlayerAppearance() 
{
  return;
  /*
  CPlayerInfo plPlayerInfo;
  // get selected player
  INDEX iSelectedPlayer = m_listAvailablePlayers.GetCurSel();
  ASSERT( iSelectedPlayer != LB_ERR);
  
  CTFileName fnPlayerName;
  fnPlayerName.PrintF( "%sPlayers\\Player%d.plr", iSelectedPlayer);
  try
  {
    // load it from the file
    plPlayerInfo.Load_t( fnPlayerName);
    // call player appearance dialog
	  CDlgPlayerAppearance dlgPlayerAppearance( plPlayerInfo.pi_pcPlayerCharacter);
    // if user wants to change player's appearance
    if( dlgPlayerAppearance.DoModal() == IDOK)
    {
      // set new appearance
      plPlayerInfo.pi_pcPlayerCharacter = dlgPlayerAppearance.m_pcPlayerCharacter;
      // and save new player's attributes
      plPlayerInfo.Save_t( fnPlayerName);
      // reload players and controls
      _pGame->LoadPlayersAndControls();
    }
  }
  catch (char *strError)
  {
    AfxMessageBox( strError);
  }
  */
}

void CDlgPlayerSettings::InitPlayersAndControlsLists(void)
{
  if( !::IsWindow( m_listAvailablePlayers.m_hWnd)) return;
  m_listAvailablePlayers.ResetContent();
  m_listAvailableControls.ResetContent();

  // fill players and controls lists
  for( INDEX iPC=0; iPC<8; iPC++)
  {
    CTString strPlayer = _pGame->gm_apcPlayers[ iPC].pc_strName;
    m_listAvailablePlayers.AddString( CString(strPlayer));
    //CTString strControls = _pGame->gm_actrlControls[ iPC].ctrl_strName;
    m_listAvailableControls.AddString( CString("dummy"));
  }
  m_listAvailableControls.SetCurSel( 0);
  m_listAvailablePlayers.SetCurSel( 0);
}

BOOL CDlgPlayerSettings::OnInitDialog() 
{
	CDialog::OnInitDialog();
  InitPlayersAndControlsLists();
	return TRUE;
}

void CDlgPlayerSettings::OnEditControls() 
{
  CControls &ctrlControls = _pGame->gm_ctrlControlsExtra;
  // try to
  try
  {
    // get selected controls
    INDEX iSelectedControls = m_listAvailableControls.GetCurSel();
    ASSERT( iSelectedControls != LB_ERR);
    CTFileName fnControlsName;
    fnControlsName.PrintF( "Controls\\Controls%d.ctl", iSelectedControls);
    // load it from the file
    ctrlControls.Load_t( fnControlsName);
    
    // call controls dialog
    CDlgPlayerControls dlgControls( ctrlControls);
    // if user wants to change controls
    if( dlgControls.DoModal() == IDOK)
    {
      // set new controls
      ctrlControls = dlgControls.m_ctrlControls;
      // depending on axis attributes and type (rotation or translation), calculates axis 
      // influence factors for all axis actions
      ctrlControls.CalculateInfluencesForAllAxis(); 
      // save new controls
      ctrlControls.Save_t( fnControlsName);
      // reload players and controls
      _pGame->LoadPlayersAndControls();
    }
  }
  catch (char *strError)
  {
    AfxMessageBox( CString(strError));
    return;
  }
}

void CDlgPlayerSettings::OnRenameControls() 
{
  CDlgRenameControls dlgRename;
  // get selected controls
  INDEX iSelectedControls = m_listAvailableControls.GetCurSel();
  ASSERT( iSelectedControls != LB_ERR);

//  CTString strName = _pGame->gm_actrlControls[ iSelectedControls].ctrl_strName;
  dlgRename.m_strName = "dummy";
  // if new file properly edited and ok pressed
  if( (dlgRename.DoModal() == IDOK) &&
      (dlgRename.m_strName.GetLength() != 0) )
  {
//    _pGame->gm_actrlControls[ iSelectedControls].ctrl_strName = dlgRename.m_strName;
    // save players and controls
    _pGame->SavePlayersAndControls();
    InitPlayersAndControlsLists();
  }
}

void CDlgPlayerSettings::OnRenamePlayer() 
{
  CDlgRenameControls dlgRename;
  // get selected controls
  INDEX iSelectedPlayer = m_listAvailablePlayers.GetCurSel();
  ASSERT( iSelectedPlayer != LB_ERR);

  CTString strName = _pGame->gm_apcPlayers[ iSelectedPlayer].pc_strName;
  dlgRename.m_strName = strName;
  // if new file properly edited and ok pressed
  if( (dlgRename.DoModal() == IDOK) &&
      (dlgRename.m_strName.GetLength() != 0) )
  {
    #ifdef _SE1_10
      _pGame->gm_apcPlayers[ iSelectedPlayer].pc_strName = CStringA(dlgRename.m_strName);
    #else
      _pGame->gm_apcPlayers[ iSelectedPlayer].pc_strName = dlgRename.m_strName;
    #endif

    // save players and controls
    _pGame->SavePlayersAndControls();
    InitPlayersAndControlsLists();
  }
}
