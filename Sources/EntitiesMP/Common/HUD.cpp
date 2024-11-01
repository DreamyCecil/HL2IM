#include "StdH.h"
#include "UI/UI.h"
#include "GameMP/SEColors.h"

#include <EntitiesMP/MusicHolder.h>
#include <EntitiesMP/EnemyBase.h>
#include <EntitiesMP/EnemyCounter.h>

// cheats
extern INDEX cht_bEnable;
extern INDEX cht_bGod;
extern INDEX cht_bFly;
extern INDEX cht_bGhost;
extern INDEX cht_bInvisible;
extern FLOAT cht_fTranslationMultiplier;

// interface control
extern INDEX hud_bShowInfo;
extern INDEX hud_bShowLatency;
extern INDEX hud_bShowMessages;
extern INDEX hud_iShowPlayers;
extern INDEX hud_iSortPlayers;
extern FLOAT hud_fOpacity;
extern FLOAT hud_fScaling;
extern FLOAT hud_tmWeaponsOnScreen;
extern INDEX hud_bShowMatchInfo;

// player statistics sorting keys
enum SortKeys {
  PSK_NAME    = 1,
  PSK_HEALTH  = 2,
  PSK_SCORE   = 3,
  PSK_MANA    = 4, 
  PSK_FRAGS   = 5,
  PSK_DEATHS  = 6,
};

// where is the bar lowest value
enum BarOrientations {
  BO_LEFT  = 1,
  BO_RIGHT = 2, 
  BO_UP    = 3,
  BO_DOWN  = 4,
};

extern const INDEX _aiWeaponsRemap[19];

// drawing variables
CPlayer *_penPlayer = NULL;
CPlayerWeapons *_penWeapons = NULL;
CDrawPort *_pdp = NULL; // [Cecil] Extern

static PIX _pixDPWidth, _pixDPHeight;
// [Cecil] Replaced _fResolutionScaling with '_fResScalingX' and '_fResScalingY'
FLOAT _fResScalingX = 1.0f;
FLOAT _fResScalingY = 1.0f;

static ULONG _ulAlphaHUD;
static COLOR _colHUD;
static COLOR _colHUDText;

static TIME _tmNow = -1.0f;
static TIME _tmLast = -1.0f;

// [Cecil] Definitions
static CFontData _fdNumbers;
static CFontData _fdNumbersGlow;

// [Cecil] UI Colors
extern INDEX hl2_colUIMain;
extern INDEX hl2_colUIEmpty;
extern INDEX hl2_colUIBorder;

// array for pointers of all players
extern CPlayer *_apenPlayers[NET_MAXGAMEPLAYERS] = {0};

// powerup textures (ORDER IS THE SAME AS IN PLAYER.ES!)
#define MAX_POWERUPS 4
static CTextureObject _atoPowerups[MAX_POWERUPS];

// [Cecil] Half-Life 2 Tile Texture
static CTextureObject _toTile;

// sniper mask texture
static CTextureObject _toSniperMask;
static CTextureObject _toSniperWheel;
static CTextureObject _toSniperArrow;
static CTextureObject _toSniperEye;
static CTextureObject _toSniperLed;

// all info about color transitions
struct ColorTransitionTable {
  COLOR ctt_colFine;      // color for values over 1.0
  COLOR ctt_colHigh;      // color for values from 1.0 to 'fMedium'
  COLOR ctt_colMedium;    // color for values from 'fMedium' to 'fLow'
  COLOR ctt_colLow;       // color for values under fLow
  FLOAT ctt_fMediumHigh;  // when to switch to high color   (normalized float!)
  FLOAT ctt_fLowMedium;   // when to switch to medium color (normalized float!)
  BOOL  ctt_bSmooth;      // should colors have smooth transition
};

static struct ColorTransitionTable _cttHUD;

extern struct WeaponInfo _awiWeapons[15];

struct WeaponInfo _awiWeapons[15] = {
  { WEAPON_NONE,       -1, -1, FALSE }, //  0
  { WEAPON_CROWBAR,    -1, -1, FALSE }, //  1
  { WEAPON_PISTOL,      0, -1, FALSE }, //  2
  { WEAPON_357,         1, -1, FALSE }, //  3
  { WEAPON_SPAS,        4, -1, FALSE }, //  4
  { WEAPON_G3SG1,       8, -1, FALSE }, //  5
  { WEAPON_SMG1,        2,  9, FALSE }, //  6
  { WEAPON_AR2,         3, 10, FALSE }, //  7
  { WEAPON_RPG,         7, -1, FALSE }, //  8
  { WEAPON_GRENADE,     6, -1, FALSE }, //  9
  { WEAPON_GRAVITYGUN, -1, -1, FALSE }, // 10
  { WEAPON_FLAMER,     -1, -1, FALSE }, // 11
  { WEAPON_LASER,      -1, -1, FALSE }, // 12
  { WEAPON_CROSSBOW,    5, -1, FALSE }, // 13
  { WEAPON_IRONCANNON, -1, -1, FALSE }, // 14
};


// compare functions for qsort()
static int qsort_CompareNames( const void *ppPEN0, const void *ppPEN1) {
  CPlayer &en0 = **(CPlayer**)ppPEN0;
  CPlayer &en1 = **(CPlayer**)ppPEN1;
  CTString strName0 = en0.GetPlayerName();
  CTString strName1 = en1.GetPlayerName();
  return strnicmp( strName0, strName1, 8);
}

static int qsort_CompareScores( const void *ppPEN0, const void *ppPEN1) {
  CPlayer &en0 = **(CPlayer**)ppPEN0;
  CPlayer &en1 = **(CPlayer**)ppPEN1;
  SLONG sl0 = en0.m_psGameStats.ps_iScore;
  SLONG sl1 = en1.m_psGameStats.ps_iScore;
  if(      sl0<sl1) return +1;
  else if( sl0>sl1) return -1;
  else              return  0;
}

static int qsort_CompareHealth( const void *ppPEN0, const void *ppPEN1) {
  CPlayer &en0 = **(CPlayer**)ppPEN0;
  CPlayer &en1 = **(CPlayer**)ppPEN1;
  SLONG sl0 = (SLONG)ceil(en0.GetHealth());
  SLONG sl1 = (SLONG)ceil(en1.GetHealth());
  if(      sl0<sl1) return +1;
  else if( sl0>sl1) return -1;
  else              return  0;
}

static int qsort_CompareManas( const void *ppPEN0, const void *ppPEN1) {
  CPlayer &en0 = **(CPlayer**)ppPEN0;
  CPlayer &en1 = **(CPlayer**)ppPEN1;
  SLONG sl0 = en0.m_iMana;
  SLONG sl1 = en1.m_iMana;
  if(      sl0<sl1) return +1;
  else if( sl0>sl1) return -1;
  else              return  0;
}

static int qsort_CompareDeaths( const void *ppPEN0, const void *ppPEN1) {
  CPlayer &en0 = **(CPlayer**)ppPEN0;
  CPlayer &en1 = **(CPlayer**)ppPEN1;
  SLONG sl0 = en0.m_psGameStats.ps_iDeaths;
  SLONG sl1 = en1.m_psGameStats.ps_iDeaths;
  if(      sl0<sl1) return +1;
  else if( sl0>sl1) return -1;
  else              return  0;
}

static int qsort_CompareFrags( const void *ppPEN0, const void *ppPEN1) {
  CPlayer &en0 = **(CPlayer**)ppPEN0;
  CPlayer &en1 = **(CPlayer**)ppPEN1;
  SLONG sl0 = en0.m_psGameStats.ps_iKills;
  SLONG sl1 = en1.m_psGameStats.ps_iKills;
  if(      sl0<sl1) return +1;
  else if( sl0>sl1) return -1;
  else              return -qsort_CompareDeaths(ppPEN0, ppPEN1);
}

static int qsort_CompareLatencies( const void *ppPEN0, const void *ppPEN1) {
  CPlayer &en0 = **(CPlayer**)ppPEN0;
  CPlayer &en1 = **(CPlayer**)ppPEN1;
  SLONG sl0 = (SLONG)ceil(en0.m_tmLatency);
  SLONG sl1 = (SLONG)ceil(en1.m_tmLatency);
  if(      sl0<sl1) return +1;
  else if( sl0>sl1) return -1;
  else              return  0;
}

// [Cecil] Info update glow
FLOAT InfoUpdate(const INDEX &iCurrentValue, INDEX &iLastValue, TIME &tmChanged) {
  const TIME tmNow = _pTimer->GetLerpedCurrentTick();
  const TIME tmTick = _pTimer->TickQuantum;

  if (iCurrentValue != iLastValue) {
    iLastValue = iCurrentValue;
    tmChanged = tmNow;
  } else {
    tmChanged = ClampUp(tmChanged, tmNow);
  }

  FLOAT tmDelta = tmNow - tmChanged;
  FLOAT fUpdateRatio = Clamp(tmDelta/2.0f, 0.0f, 1.0f);

  return Lerp(1.0f, 0.0f, fUpdateRatio);
};

// fill array with players' statistics (returns current number of players in game)
extern INDEX SetAllPlayersStats( INDEX iSortKey) {
  // determine maximum number of players for this session
  INDEX iPlayers    = 0;
  INDEX iMaxPlayers = CEntity::GetMaxPlayers();
  CPlayer *penCurrent;
  // loop thru potentional players 
  for( INDEX i=0; i<iMaxPlayers; i++)
  { // ignore non-existent players
    penCurrent = (CPlayer *)CEntity::GetPlayerEntity(i);
    if( penCurrent==NULL) continue;
    // fill in player parameters
    _apenPlayers[iPlayers] = penCurrent;
    // advance to next real player
    iPlayers++;
  }
  // sort statistics by some key if needed
  switch( iSortKey) {
    case PSK_NAME:    qsort(_apenPlayers, iPlayers, sizeof(CPlayer*), qsort_CompareNames);   break;
    case PSK_SCORE:   qsort(_apenPlayers, iPlayers, sizeof(CPlayer*), qsort_CompareScores);  break;
    case PSK_HEALTH:  qsort(_apenPlayers, iPlayers, sizeof(CPlayer*), qsort_CompareHealth);  break;
    case PSK_MANA:    qsort(_apenPlayers, iPlayers, sizeof(CPlayer*), qsort_CompareManas);   break;
    case PSK_FRAGS:   qsort(_apenPlayers, iPlayers, sizeof(CPlayer*), qsort_CompareFrags);   break;
    case PSK_DEATHS:  qsort(_apenPlayers, iPlayers, sizeof(CPlayer*), qsort_CompareDeaths);  break;
    default:  break;  // invalid or NONE key specified so do nothing
  }
  // all done
  return iPlayers;
};

// ----------------------- drawing functions

// [Cecil] Setup global UI variables independently
void SetGlobalUI(CDrawPort *pdp) {
  _pdp = pdp;
  _pixDPWidth = _pdp->GetWidth();
  _pixDPHeight = _pdp->GetHeight();

  _fResScalingX = FLOAT(_pixDPWidth) / 640.0f;
  _fResScalingY = FLOAT(_pixDPHeight) / 480.0f;

  _colHUD     = 0x4C80BB00;
  _colHUDText = SE_COL_ORANGE_LIGHT;
  _ulAlphaHUD = NormFloatToByte(hud_fOpacity);
  _tmNow = _pTimer->CurrentTick();
};

// [Cecil] Get scaling values
void GetScaling(FLOAT &fX, FLOAT &fY) {
  fX = _fResScalingX;
  fY = _fResScalingY;
};

// [Cecil] Set HUD text size
void SetTextSize(CDrawPort *pdp, BOOL bSmall) {
  const FLOAT fSpacing = (bSmall ? 4.0f : 8.0f);
  const FLOAT fScaling = (bSmall ? 16.0f : 36.0f);

  pdp->SetTextCharSpacing(fSpacing * (_fResScalingY/1.6f));
  pdp->SetTextScaling(fScaling/64.0f/1.6f * _fResScalingY);
};

void HUD_DrawBorder(FLOAT fX, FLOAT fY, FLOAT fSizeX, FLOAT fSizeY, COLOR colTiles, UBYTE ubAnchor) {
  AnchorPos(fX, 640, ubAnchor, TRUE);
  AnchorPos(fY, 480, ubAnchor, FALSE);

  fSizeX *= _fResScalingY;
  fSizeY *= _fResScalingY;

  const FLOAT fTileSize = 8.0f;

  // determine exact positions
  const FLOAT fLeft  = fX; 
  const FLOAT fRight = fX + fSizeX; 
  const FLOAT fUp    = fY; 
  const FLOAT fDown  = fY + fSizeY;

  const FLOAT fLeftEnd  = fLeft  + fTileSize;
  const FLOAT fRightBeg = fRight - fTileSize; 
  const FLOAT fUpEnd    = fUp    + fTileSize; 
  const FLOAT fDownBeg  = fDown  - fTileSize;

  // put corners
  _pdp->InitTexture(&_toTile, TRUE); // clamping on!
  _pdp->AddTexture(fLeft,  fUp,   fLeftEnd,  fUpEnd,   colTiles);
  _pdp->AddTexture(fRight, fUp,   fRightBeg, fUpEnd,   colTiles);
  _pdp->AddTexture(fRight, fDown, fRightBeg, fDownBeg, colTiles);
  _pdp->AddTexture(fLeft,  fDown, fLeftEnd,  fDownBeg, colTiles);

  // put edges
  /*_pdp->AddTexture(fLeftEnd, fUp,    fRightBeg, fUpEnd,   0.4f, 0.0f, 0.6f, 1.0f, colTiles);
  _pdp->AddTexture(fLeftEnd, fDown,  fRightBeg, fDownBeg, 0.4f, 0.0f, 0.6f, 1.0f, colTiles);
  _pdp->AddTexture(fLeft,    fUpEnd, fLeftEnd,  fDownBeg, 0.0f, 0.4f, 1.0f, 0.6f, colTiles);
  _pdp->AddTexture(fRight,   fUpEnd, fRightBeg, fDownBeg, 0.0f, 0.4f, 1.0f, 0.6f, colTiles);*/

  _pdp->AddTexture(fLeftEnd, fUp,    fRightBeg, fUpEnd,   0.5f, 0.0f, 1.0f, 1.0f, colTiles); // top
  _pdp->AddTexture(fLeftEnd, fDown,  fRightBeg, fDownBeg, 0.5f, 0.0f, 1.0f, 1.0f, colTiles); // bottom
  _pdp->AddTexture(fLeft,    fUpEnd, fLeftEnd,  fDownBeg, 0.0f, 0.5f, 1.0f, 1.0f, colTiles); // left
  _pdp->AddTexture(fRight,   fUpEnd, fRightBeg, fDownBeg, 0.0f, 0.5f, 1.0f, 1.0f, colTiles); // right

  // put center
  _pdp->AddTexture(fLeftEnd, fUpEnd, fRightBeg, fDownBeg, 0.4f, 0.4f, 0.6f, 0.6f, colTiles);
  _pdp->FlushRenderingQueue();
};

// draw text
void HUD_DrawText(FLOAT fX, FLOAT fY, const CTString &strText, COLOR col, const INDEX &iType, UBYTE ubAnchor) {
  AnchorPos(fX, 640, ubAnchor, TRUE);
  AnchorPos(fY, 480, ubAnchor, FALSE);

  switch (iType) {
    case -1: _pdp->PutText(strText, fX, fY, col); break;
    case 0: _pdp->PutTextC(strText, fX, fY, col); break;
    case 1: _pdp->PutTextR(strText, fX, fY, col); break;
  }
};

// draw bar
void HUD_DrawBar(FLOAT fX, FLOAT fY, FLOAT fSizeX, FLOAT fSizeY, FLOAT fSpacing, INDEX iParts, COLOR colActive, COLOR colPassive, FLOAT fValue, UBYTE ubAnchor) {
  AnchorPos(fX, 640, ubAnchor, TRUE);
  AnchorPos(fY, 480, ubAnchor, FALSE);

  fSizeX *= _fResScalingY;
  fSizeY *= _fResScalingY;
  fSpacing *= _fResScalingY;

  for (INDEX iPart = 0; iPart < iParts; iPart++) {
    FLOAT fNext = (fSizeX+fSpacing) * iPart;
    BOOL bActive = (fValue > FLOAT(iPart)/FLOAT(iParts));

    _pdp->Fill(fX + fNext, fY, fSizeX, fSizeY, (bActive ? colActive : colPassive));
  }
};

static void DrawRotatedQuad(class CTextureObject *_pTO, FLOAT fX, FLOAT fY, FLOAT fSize, ANGLE aAngle, COLOR col) {
  FLOAT fSinA = Sin(aAngle);
  FLOAT fCosA = Cos(aAngle);
  FLOAT fSinPCos = fCosA*fSize + fSinA*fSize;
  FLOAT fSinMCos = fSinA*fSize - fCosA*fSize;
  FLOAT fI0, fJ0, fI1, fJ1, fI2, fJ2, fI3, fJ3;

  fI0 = fX - fSinPCos; fJ0 = fY - fSinMCos;
  fI1 = fX + fSinMCos; fJ1 = fY - fSinPCos;
  fI2 = fX + fSinPCos; fJ2 = fY + fSinMCos;
  fI3 = fX - fSinMCos; fJ3 = fY + fSinPCos;
  
  _pdp->InitTexture(_pTO);
  _pdp->AddTexture(fI0, fJ0, 0, 0, col, fI1, fJ1, 0, 1, col,
                   fI2, fJ2, 1, 1, col, fI3, fJ3, 1, 0, col);
  _pdp->FlushRenderingQueue();  
};

static void DrawAspectCorrectTextureCentered(class CTextureObject *_pTO, FLOAT fX, FLOAT fY, FLOAT fWidth, COLOR col) {
  CTextureData *ptd = (CTextureData*)_pTO->GetData();
  FLOAT fTexSizeI = ptd->GetPixWidth();
  FLOAT fTexSizeJ = ptd->GetPixHeight();
  FLOAT fHeight = fWidth*fTexSizeJ/fTexSizeJ;
  
  _pdp->InitTexture(_pTO);
  _pdp->AddTexture(fX - fWidth/2, fY - fHeight/2, fX + fWidth/2, fY + fHeight/2, 0, 0, 1, 1, col);
  _pdp->FlushRenderingQueue();
};

// draw sniper mask
static void HUD_DrawSniperMask(void) {
  // determine location
  const FLOAT fSizeI = _pixDPWidth;
  const FLOAT fSizeJ = _pixDPHeight;
  const FLOAT fCenterI = fSizeI/2;  
  const FLOAT fCenterJ = fSizeJ/2;  
  const FLOAT fBlackStrip = (fSizeI-fSizeJ)/2;

  COLOR colMask = C_WHITE|CT_OPAQUE;
  
  CTextureData *ptd = (CTextureData*)_toSniperMask.GetData();
  const FLOAT fTexSizeI = ptd->GetPixWidth();
  const FLOAT fTexSizeJ = ptd->GetPixHeight();

  // main sniper mask
  _pdp->InitTexture( &_toSniperMask);
  _pdp->AddTexture( fBlackStrip, 0, fCenterI, fCenterJ, 0.98f, 0.02f, 0, 1.0f, colMask);
  _pdp->AddTexture( fCenterI, 0, fSizeI-fBlackStrip, fCenterJ, 0, 0.02f, 0.98f, 1.0f, colMask);
  _pdp->AddTexture( fBlackStrip, fCenterJ, fCenterI, fSizeJ, 0.98f, 1.0f, 0, 0.02f, colMask);
  _pdp->AddTexture( fCenterI, fCenterJ, fSizeI-fBlackStrip, fSizeJ, 0, 1, 0.98f, 0.02f, colMask);
  _pdp->FlushRenderingQueue();
  _pdp->Fill(0, 0, fBlackStrip+1, fSizeJ, C_BLACK|CT_OPAQUE);
  _pdp->Fill(fSizeI - fBlackStrip - 1, 0, fBlackStrip + 1, fSizeJ, C_BLACK|CT_OPAQUE);

  colMask = LerpColor(SE_COL_BLUE_LIGHT, C_WHITE, 0.25f);

  FLOAT fDistance = _penWeapons->m_fRayHitDistance;
  FLOAT aFOV = Lerp(_penWeapons->m_fSniperFOVlast, _penWeapons->m_fSniperFOV,
                    _pTimer->GetLerpFactor());
  CTString strTmp;
  
  // wheel
  FLOAT fZoom = 1.0f/tan(RadAngle(aFOV)*0.5f);  // 2.0 - 8.0
  
  FLOAT fAFact = (Clamp(aFOV, 14.2f, 53.1f)-14.2f)/(53.1f-14.2f); // only for zooms 2x-4x !!!!!!
  ANGLE aAngle = 314.0f+fAFact*292.0f;

  DrawRotatedQuad(&_toSniperWheel, fCenterI, fCenterJ, 40.0f*_fResScalingY, aAngle, colMask|0x44);
  
  FLOAT fTM = _pTimer->GetLerpedCurrentTick();
  
  COLOR colLED;
  if (_penWeapons->m_tmLastSniperFire+1.25f<fTM) { // blinking
    colLED = 0x44FF22BB;
  } else {
    colLED = 0xFF4422DD;
  }

  // reload indicator
  DrawAspectCorrectTextureCentered(&_toSniperLed, fCenterI - 37.0f*_fResScalingY, fCenterJ + 36.0f*_fResScalingY, 15.0f*_fResScalingY, colLED);
    
  if (_fResScalingX >= 1.0f) {
    FLOAT _fIconSize;
    FLOAT _fLeftX, _fLeftYU, _fLeftYD;
    FLOAT _fRightX, _fRightYU, _fRightYD;

    if (_fResScalingX <= 1.3f) {
      _pdp->SetFont(_pfdConsoleFont);
      _pdp->SetTextAspect(1.0f);
      _pdp->SetTextScaling(1.0f);
      _fIconSize = 22.8f;
      _fLeftX = 159.0f;
      _fLeftYU = 8.0f;
      _fLeftYD = 6.0f;
      _fRightX = 159.0f;
      _fRightYU = 11.0f;
      _fRightYD = 6.0f;

    } else {
      _pdp->SetFont(_pfdDisplayFont);
      _pdp->SetTextAspect(1.0f);
      _pdp->SetTextScaling(0.7f * _fResScalingY);
      _fIconSize = 19.0f;
      _fLeftX = 162.0f;
      _fLeftYU = 8.0f;
      _fLeftYD = 6.0f;
      _fRightX = 162.0f;
      _fRightYU = 11.0f;
      _fRightYD = 6.0f;
    }
     
    // arrow + distance
    DrawAspectCorrectTextureCentered(&_toSniperArrow, fCenterI - _fLeftX*_fResScalingY, fCenterJ - _fLeftYU*_fResScalingY, _fIconSize*_fResScalingY, 0xFFCC3399);

    if (fDistance > 9999.9f) {
      strTmp.PrintF("---.-");
    } else if (TRUE) {
      strTmp.PrintF("%.1f", fDistance);
    }

    _pdp->PutTextC(strTmp, fCenterI - _fLeftX*_fResScalingY, fCenterJ + _fLeftYD*_fResScalingY, colMask|0xAA);
    
    // eye + zoom level
    DrawAspectCorrectTextureCentered(&_toSniperEye, fCenterI+_fRightX*_fResScalingY, fCenterJ - _fRightYU*_fResScalingY, _fIconSize*_fResScalingY, 0xFFCC3399); //SE_COL_ORANGE_L
    strTmp.PrintF("%.1fx", fZoom);

    _pdp->PutTextC(strTmp, fCenterI + _fRightX*_fResScalingY, fCenterJ + _fRightYD*_fResScalingY, colMask|0xAA);
  }
}


// helper functions

// fill weapon and ammo table with current state
static void FillWeaponAmmoTables(void) {
  // weapon possesion
  INDEX iAvailableWeapons = _penWeapons->m_iAvailableWeapons;

  for (INDEX iWeapon = WEAPON_NONE + 1; iWeapon < WEAPON_LAST; iWeapon++) {
    if (_awiWeapons[iWeapon].wi_wtWeapon != WEAPON_NONE) {
      _awiWeapons[iWeapon].wi_bHasWeapon = (iAvailableWeapons & (1 << (_awiWeapons[iWeapon].wi_wtWeapon - 1)));
    }
  }
};

//<<<<<<< DEBUG FUNCTIONS >>>>>>>

#ifdef ENTITY_DEBUG
CRationalEntity *DBG_prenStackOutputEntity = NULL;
#endif
void HUD_SetEntityForStackDisplay(CRationalEntity *pren)
{
#ifdef ENTITY_DEBUG
  DBG_prenStackOutputEntity = pren;
#endif
  return;
}

#ifdef ENTITY_DEBUG
static void HUD_DrawEntityStack()
{
  CTString strTemp;
  PIX pixFontHeight;
  ULONG pixTextBottom;

  if (DBG_prenStackOutputEntity != NULL) {
    // [Cecil] Untarget
    if (DBG_prenStackOutputEntity->GetFlags() & ENF_DELETED) {
      DBG_prenStackOutputEntity = NULL;
      return;
    }

    pixFontHeight = _pfdDisplayFont->fd_pixCharHeight;
    pixTextBottom = _pixDPHeight*0.83;
    _pdp->SetFont(_pfdDisplayFont);
    _pdp->SetTextScaling(1.0f);
    
    INDEX ctStates = DBG_prenStackOutputEntity->en_stslStateStack.Count();
    strTemp.PrintF("-- stack of '%s' (%s) @ %gs\n", DBG_prenStackOutputEntity->GetName(),
      DBG_prenStackOutputEntity->en_pecClass->ec_pdecDLLClass->dec_strName,
      _pTimer->CurrentTick());
    _pdp->PutText(strTemp, 1, pixTextBottom-pixFontHeight*(ctStates+1), _colHUD|_ulAlphaHUD);
      
    for (INDEX iState = ctStates-1; iState >= 0; iState--) {
      SLONG slState = DBG_prenStackOutputEntity->en_stslStateStack[iState];
      strTemp.PrintF("0x%08x %s\n", slState, DBG_prenStackOutputEntity->en_pecClass->ec_pdecDLLClass->HandlerNameForState(slState));
      _pdp->PutText(strTemp, 1, pixTextBottom-pixFontHeight*(iState+1), _colHUD|_ulAlphaHUD);
    }
  }
}
#endif
//<<<<<<< DEBUG FUNCTIONS >>>>>>>

// main

// render interface (frontend) to drawport
// (units are in pixels for 640x480 resolution - for other res HUD will be scalled automatically)
extern void DrawHUD(CPlayer *penPlayerCurrent, CDrawPort *pdpCurrent, BOOL bSnooping, const CPlayer *penPlayerOwner)
{
  // if no player or snooping but owner player is NULL
  if (penPlayerCurrent == NULL || (penPlayerCurrent->GetFlags() & ENF_DELETED)
   || (bSnooping && penPlayerOwner == NULL)) {
    return;
  }

  // find last values in case of predictor
  CPlayer *penLast = (CPlayer*)penPlayerCurrent;
  if (penPlayerCurrent->IsPredictor()) {
    penLast = (CPlayer*)(((CPlayer*)penPlayerCurrent)->GetPredicted());
  }

  ASSERT(penLast != NULL);

  if (penLast == NULL) {
    return;
  }

  // cache local variables
  hud_fOpacity = Clamp(hud_fOpacity, 0.1f, 1.0f);
  hud_fScaling = Clamp(hud_fScaling, 0.5f, 1.2f);

  _penPlayer = penPlayerCurrent;
  _penWeapons = _penPlayer->GetPlayerWeapons();

  // [Cecil] Setup global UI variables independently
  SetGlobalUI(pdpCurrent);

  // draw sniper mask (original mask even if snooping)
  if (((CPlayerWeapons*)&*penPlayerOwner->m_penWeapons)->m_iCurrentWeapon == WEAPON_G3SG1
   && ((CPlayerWeapons*)&*penPlayerOwner->m_penWeapons)->m_iSniping > 0) {
    HUD_DrawSniperMask();
  }
  
  // [Cecil] TEMP: Interface overlay
  /*_pdp->InitTexture(&_toOverlay);
  FLOAT fBase = 480; //-80;
  _pdp->AddTexture(0, fBase*_fScalingY - 80*_fScalingX, 640*_fScalingX, fBase*_fScalingY, 0xFFFFFFFF);
  _pdp->FlushRenderingQueue();*/

  INDEX iCurrentWeapon = _penWeapons->m_iCurrentWeapon;
  INDEX iWantedWeapon  = _penWeapons->m_iWantedWeapon;

  // [Cecil] Prepare Half-Life 2 UI
  HL2_UIInit();

  // HEV suit display
  if (_penPlayer->m_bHEVSuit)
  {
    // Normal numbers layer
    _pdp->SetFont(&_fdNumbers);
    SetTextSize(_pdp, FALSE);
    _pdp->SetTextAspect(1.0f);

    HL2_SetAlpha(hl2_colUIMain & 0xFF);
    HL2_SetGlow(FALSE);

    HL2_DrawHealth(penLast);
    HL2_DrawArmor(penLast);

    if (_awiWeapons[iCurrentWeapon].wi_iAmmo != -1) {
      HL2_DrawCurrentWeapon(penLast);
    }

    // Glowing numbers layer
    _pdp->SetFont(&_fdNumbersGlow);
    SetTextSize(_pdp, FALSE);
    _pdp->SetTextAspect(1.0f);

    HL2_SetAlpha(0);
    HL2_SetGlow(TRUE);

    HL2_DrawHealth(penLast);
    HL2_DrawArmor(penLast);

    if (_awiWeapons[iCurrentWeapon].wi_iAmmo != -1) {
      HL2_DrawCurrentWeapon(penLast);
    }

    HL2_DrawBars();
  }

  // Weapon change scroll
  hud_tmWeaponsOnScreen = Clamp(hud_tmWeaponsOnScreen, 0.0f, 10.0f);
  HL2_DrawWeaponScroll(penLast);

  // [Cecil] Print latency here
  if (hud_bShowLatency) {
    _pdp->SetFont(_pfdConsoleFont);
    _pdp->SetTextScaling(1.0f);
    _pdp->SetTextAspect(1.0f);

    CTString strLatency;
    strLatency.PrintF("%4.0fms", _penPlayer->m_tmLatency*1000.0f);
    _pdp->PutTextR(strLatency, _pixDPWidth, _pixDPHeight - _pfdConsoleFont->GetHeight(), UI_COL(1.0f)|CT_OPAQUE);
  }

  // [Cecil] Edited way of rendering player info
  _pdp->SetFont(_pfdDisplayFont);
  _pdp->SetTextScaling(1.5f);

  const BOOL bSinglePlay = GetSP()->sp_bSinglePlayer;
  const BOOL bCooperative = GetSP()->sp_bCooperative && !bSinglePlay;
  const BOOL bScoreMatch = !GetSP()->sp_bCooperative && !GetSP()->sp_bUseFrags;
  const BOOL bFragMatch = !GetSP()->sp_bCooperative &&  GetSP()->sp_bUseFrags;

  const COLOR colList = hl2_colUIMain|0xFF;
  const FLOAT fCharWidth = _pfdDisplayFont->GetWidth();
  const FLOAT fCharHeight = _pfdDisplayFont->GetHeight();
  INDEX iScoreSum = 0;

  if (!bSinglePlay) {

    // generate and sort by mana list of active players
    BOOL bMaxScore = TRUE;
    BOOL bMaxMana = TRUE;
    BOOL bMaxFrags = TRUE;
    BOOL bMaxDeaths = TRUE;

    hud_iSortPlayers = Clamp(hud_iSortPlayers, -1L, 6L);
    SortKeys eKey = (SortKeys)hud_iSortPlayers;

    if (hud_iSortPlayers == -1) {
      if (bCooperative) {
        eKey = PSK_HEALTH;
      } else if (bScoreMatch) {
        eKey = PSK_SCORE;
      } else if (bFragMatch) {
        eKey = PSK_FRAGS;
      } else {
        eKey = PSK_NAME;
      }
    }

    if (bCooperative) {
      eKey = (SortKeys)Clamp((INDEX)eKey, 0L, 3L);
    }

    // prevent health snooping in deathmatch
    if (eKey == PSK_HEALTH && (bScoreMatch || bFragMatch)) {
      eKey = PSK_NAME;
    };

    INDEX iPlayers = SetAllPlayersStats(eKey);

    for (INDEX i = 0; i < iPlayers; i++) {
      CPlayer *penPlayer = _apenPlayers[i];

      const CTString strName = penPlayer->GetPlayerName();
      const INDEX iScore = penPlayer->m_psGameStats.ps_iScore;
      const INDEX iMana = penPlayer->m_iMana;
      const INDEX iFrags = penPlayer->m_psGameStats.ps_iKills;
      const INDEX iDeaths = penPlayer->m_psGameStats.ps_iDeaths;
      const INDEX iHealth = ClampDn((INDEX)ceil(penPlayer->GetHealth()), 0L);
      const INDEX iArmor = ClampDn((INDEX)ceil(penPlayer->m_fArmor), 0L);

      CTString strScore, strMana, strFrags, strDeaths, strHealth, strArmor;
      strScore.PrintF("%d", iScore);
      strMana.PrintF("%d", iMana);
      strFrags.PrintF("%d", iFrags);
      strDeaths.PrintF("%d", iDeaths);
      strHealth.PrintF("%d", iHealth);
      strArmor.PrintF("%d", iArmor);

      if (iMana > _penPlayer->m_iMana) {
        bMaxMana   = FALSE;
      }
      if (iScore > _penPlayer->m_psGameStats.ps_iScore) {
        bMaxScore  = FALSE;
      }
      if (iFrags > _penPlayer->m_psGameStats.ps_iKills) {
        bMaxFrags  = FALSE;
      }
      if (iDeaths > _penPlayer->m_psGameStats.ps_iDeaths) {
        bMaxDeaths = FALSE;
      }

      // eventually print it out
      if (hud_iShowPlayers == 1 || hud_iShowPlayers == -1 && !bSinglePlay) {
        // printout location and info aren't the same for deathmatch and coop play
        const FLOAT fYPos = fCharHeight * (i + 2);

        // [Cecil] Different color for the current player
        COLOR colPlayerList = (_penPlayer == penPlayer ? 0xCCCCCCFF : hl2_colUIMain|0xFF);

        if (bCooperative) { 
          _pdp->PutTextR(strName,     _pixDPWidth - 12*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC(strHealth,   _pixDPWidth -  9*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC("/",         _pixDPWidth -  6*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC(strArmor,    _pixDPWidth -  3*fCharWidth, fYPos, colPlayerList);
        } else if (bScoreMatch) {
          _pdp->PutTextR(strName,     _pixDPWidth - 12*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC(strScore,    _pixDPWidth -  9*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC("/",         _pixDPWidth -  6*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC(strMana,     _pixDPWidth -  3*fCharWidth, fYPos, colPlayerList);
        } else {
          _pdp->PutTextR(strName,     _pixDPWidth - 12*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC(strFrags,    _pixDPWidth -  9*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC("/",         _pixDPWidth -  6*fCharWidth, fYPos, colPlayerList);
          _pdp->PutTextC(strDeaths,   _pixDPWidth -  3*fCharWidth, fYPos, colPlayerList);
        }
      }
      // calculate summ of scores (for coop mode)
      iScoreSum += iScore;  
    }

    // draw remaining time if time based death- or scorematch
    if ((bScoreMatch || bFragMatch) && hud_bShowMatchInfo) {
      CTString strLimitsInfo = "";
      if (GetSP()->sp_iTimeLimit > 0) {
        FLOAT fTimeLeft = ClampDn(GetSP()->sp_iTimeLimit*60.0f - _pNetwork->GetGameTime(), 0.0f);
        strLimitsInfo.PrintF("%s%s: %s\n", strLimitsInfo, TRANS("TIME LEFT"), TimeToString(fTimeLeft));
      }

      extern INDEX SetAllPlayersStats(INDEX iSortKey);

      // fill players table
      const INDEX ctPlayers = SetAllPlayersStats(bFragMatch ? 5 : 3); // sort by frags or by score

      // find maximum frags/score that one player has
      INDEX iMaxFrags = LowerLimit(INDEX(0));
      INDEX iMaxScore = LowerLimit(INDEX(0));

      for (INDEX iMaxScorePlayer = 0; iMaxScorePlayer < ctPlayers; iMaxScorePlayer++) {
        CPlayer *penPlayer = _apenPlayers[iMaxScorePlayer];
        iMaxFrags = Max(iMaxFrags, penPlayer->m_psLevelStats.ps_iKills);
        iMaxScore = Max(iMaxScore, penPlayer->m_psLevelStats.ps_iScore);
      }

      if (GetSP()->sp_iFragLimit > 0) {
        INDEX iFragsLeft = ClampDn(GetSP()->sp_iFragLimit-iMaxFrags, INDEX(0));
        strLimitsInfo.PrintF("%s%s: %d\n", strLimitsInfo, TRANS("FRAGS LEFT"), iFragsLeft);
      }

      if (GetSP()->sp_iScoreLimit > 0) {
        INDEX iScoreLeft = ClampDn(GetSP()->sp_iScoreLimit-iMaxScore, INDEX(0));
        strLimitsInfo.PrintF("%s%s: %d\n", strLimitsInfo, TRANS("SCORE LEFT"), iScoreLeft);
      }
      _pdp->PutText(strLimitsInfo, 3*fCharWidth, fCharHeight*2, colList);
    }
  }

  #ifdef ENTITY_DEBUG
  // if entity debug is on, draw entity stack
  HUD_DrawEntityStack();
  #endif

  // in the end, remember the current time so it can be used in the next frame
  _tmLast = _tmNow;
};

// initialize all that's needed for drawing the HUD
extern void InitHUD(void) {
  try {
    // initialize and load HUD numbers font
    DECLARE_CTFILENAME(fnFont, "Fonts\\NumbersUI.fnt");
    _fdNumbers.Load_t(fnFont);

    DECLARE_CTFILENAME(fnGlowFont, "Fonts\\NumbersGlow.fnt");
    _fdNumbersGlow.Load_t(fnGlowFont);
        
    // initialize powerup textures (DO NOT CHANGE ORDER!)
    _atoPowerups[0].SetData_t(CTFILENAME("TexturesMP\\Interface\\PInvisibility.tex"));
    _atoPowerups[1].SetData_t(CTFILENAME("TexturesMP\\Interface\\PInvulnerability.tex"));
    _atoPowerups[2].SetData_t(CTFILENAME("TexturesMP\\Interface\\PSeriousDamage.tex"));
    _atoPowerups[3].SetData_t(CTFILENAME("TexturesMP\\Interface\\PSeriousSpeed.tex"));

    // initialize sniper mask texture
    _toSniperMask.SetData_t(CTFILENAME("TexturesMP\\Interface\\SniperMask.tex"));
    _toSniperWheel.SetData_t(CTFILENAME("TexturesMP\\Interface\\SniperWheel.tex"));
    _toSniperArrow.SetData_t(CTFILENAME("TexturesMP\\Interface\\SniperArrow.tex"));
    _toSniperEye.SetData_t(CTFILENAME("TexturesMP\\Interface\\SniperEye.tex"));
    _toSniperLed.SetData_t(CTFILENAME("TexturesMP\\Interface\\SniperLed.tex"));

    // initialize tile texture
    _toTile.SetData_t(CTFILENAME("Textures\\Interface\\HL2_HudTile.tex"));
    
    ((CTextureData*)_atoPowerups[0].GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_atoPowerups[1].GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_atoPowerups[2].GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_atoPowerups[3].GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_toTile.GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_toSniperMask.GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_toSniperWheel.GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_toSniperArrow.GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_toSniperEye.GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_toSniperLed.GetData())->Force(TEX_CONSTANT);

  } catch (char *strError) {
    FatalError(strError);
  }
};

// clean up
extern void EndHUD(void) {};

