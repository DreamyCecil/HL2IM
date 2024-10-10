/* Copyright (c) 2024 Dreamy Cecil
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

#include "UI.h"
#include <EntitiesMP/Cecil/Weapons.h>

#include <EntitiesMP/MusicHolder.h>
#include <EntitiesMP/EnemyBase.h>
#include <EntitiesMP/EnemyCounter.h>

#define SHIFT_X 53
#define SHIFT_Y -3

extern CDrawPort *_pdp;
extern CPlayer *_penPlayer;
extern CPlayerWeapons *_penWeapons;

static BOOL _bGlow = FALSE;
static UBYTE _ubAlpha = 0x8F;

extern struct WeaponInfo _awiWeapons[15];
extern FLOAT _fResScalingX;
extern FLOAT _fResScalingY;

// [Cecil] UI Color
extern INDEX hl2_colUIMain   = 0xFFFF008F;
extern INDEX hl2_colUIEmpty  = 0xFF000000; // alpha doesn't matter
extern INDEX hl2_colUIBorder = 0x0000003F;

// [Cecil] Half-Life 2 Icons
//static CTextureObject _toOverlay;
//static CTextureObject _toWeapons;
static CTextureObject _toHealth;
static CTextureObject _toSuit;
static CTextureObject _toAmmo;
static CTextureObject _toAlt;
static CTextureObject _toPower;
static CTextureObject _toOxygen;
static CTextureObject _toBoss;
static CTextureObject _toCounter;

static CTextureObject _atoAmmo[11];
static CTextureObject _atoWeapon[14];
static CTextureObject _atoWeaponGlow[14];
static BOOL _abWeaponIconColor[14];

// [Cecil] Weapon Scroll
extern const INDEX _aiWeaponsRemap[19];

static const CTString _astrWeaponName[][2] = {
  {"CROWBAR", ""},
  {"ZERO-POINT ENERGY GUN", "(GRAVITY GUN)"},
  {"9MM PISTOL", ""},
  {".357 MAGNUM", ""},
  {"SMG", "(SUBMACHINE GUN)"},
  {"OVERWATCH STANDARD ISSUE", "(PULSE RIFLE)"},
  {"SHOTGUN", ""},
  {"CROSSBOW", ""},
  {"G3SG1", "(TEMPORARY CS:S PORT)"},
  {"GRENADE", ""},
  {"RPG", "(ROCKET PROPELLED GRENADE)"},
  {"XOP FLAMETHROWER", "(SS LEFTOVER)"},
  {"XL2 LASERGUN", "(SS LEFTOVER)"},
  {"SBC CANNON", "(SS LEFTOVER)"},
};

// Screen anchor
void AnchorPos(FLOAT &fPos, FLOAT fLimit, UBYTE ubFlags, BOOL bHor) {
  // adjust flags
  if (bHor) {
    ubFlags &= SAF_HOR_MASK;
  } else {
    ubFlags &= SAF_VER_MASK;
  }

  // find correct position
  const FLOAT fScaling = (bHor ? _fResScalingX : _fResScalingY);
  const BOOL bOpposite = (bHor ? (ubFlags & SAF_RIGHT) : (ubFlags & SAF_BOTTOM));
  const BOOL bCenter = (ubFlags & SAF_CENTER);

  FLOAT fOpposite = (fLimit*fScaling - (fLimit - fPos)*_fResScalingY);
  FLOAT fNormal = fPos * _fResScalingY;

  // in the center
  if (bCenter) {
    fPos = (fNormal + fOpposite)/2.0f;

  // on either side
  } else {
    fPos = (bOpposite ? fOpposite : fNormal);
  }
};

// String with only color codes
CTString StringWithColors(const CTString &str) {
  CTString strResult = str;

  // start at the beginning of both strings
  const char *pchSrc = str.str_String;
  char *pchDst = strResult.str_String;

  while (pchSrc[0] != 0) {
    // source char is not escape char
    if (pchSrc[0] != '^') {
      *pchDst++ = *pchSrc++;
      continue;
    }

    // check the next char
    switch (pchSrc[1]) {
      // if one of the control codes, skip corresponding number of characters
      case 'a': pchSrc += 2+FindZero((UBYTE*)pchSrc+2, 2); break;
      case 'f': pchSrc += 2+FindZero((UBYTE*)pchSrc+2, 1); break;
      case 'b': case 'i': case 'r': case 'o':
      case 'A': case 'F': case 'B': case 'I':

      // if it is the escape char again, skip the first escape and copy the char
      case '^': pchSrc++; *pchDst++ = *pchSrc++; break;

      // something else
      default: *pchDst++ = *pchSrc++; break;
    }
  }

  *pchDst++ = 0;
  return strResult;
};

// Word wrap for a string
INDEX WordWrap(CDrawPort *pdp, CTString &strText, FLOAT fWidth) {
  INDEX ctLines = 1;
  const FLOAT fScale = pdp->dp_fTextScaling;
  const FLOAT fLineWidth = fWidth;

  // needs to be divided into multiple lines
  if ((pdp->GetTextWidth(strText) / fScale) > fWidth) {
    CTString str(strText);
    CTString strWord = "";

    FLOAT fSpaceLeft = fLineWidth;
    const FLOAT fSpaceWidth = pdp->GetTextWidth(" ") / fScale;

    INDEX ctChars = str.Length();
    INDEX iLastSpace = 0;

    // go through each character
    for (INDEX iChar = 0; iChar < ctChars; iChar++) {
      char chr = str.str_String[iChar];
      char chrNext = '_';

      BOOL bNextAvailable = (iChar < ctChars-1);

      // build the word before any divider
      if (chr != ' ') {
        strWord.PrintF("%s%c", strWord, chr);

        // check next character
        if (bNextAvailable) {
          chrNext = str.str_String[iChar+1];

          // not a divider, continue building the word
          if (chrNext != ' ') {
            continue;
          }
        }
      // ignore dividers
      } else {
        continue;
      }

      FLOAT fWord = pdp->GetTextWidth(strWord) / fScale;
      FLOAT fCheckWidth = (fWord + fSpaceWidth);

      if (fCheckWidth > fSpaceLeft) {
        str.DeleteChar(iLastSpace);
        str.InsertChar(iLastSpace, '\n');
        iLastSpace = 0;

        fSpaceLeft = fLineWidth - fWord;
        ctLines++;

      } else {
        fSpaceLeft -= fCheckWidth;
      }

      // reset the word
      strWord = "";

      // divider after the word
      if (bNextAvailable) {
        if (chrNext == ' ') {
          iLastSpace = iChar+1;
        }
      }
    }

    strText = str;
  }

  return ctLines;
};

void HL2_UIInit(void) {
  //_toOverlay.SetData_t(CTFILENAME("Textures\\Interface\\Overlay.tex"));
  //_toWeapons.SetData_t(CTFILENAME("Textures\\Interface\\WeaponsOverlay.tex"));
  _toHealth.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Health.tex"));
  _toSuit.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Suit.tex"));
  _toAmmo.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Ammo.tex"));
  _toAlt.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Alt.tex"));
  _toPower.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Power.tex"));
  _toOxygen.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Oxygen.tex"));
  _toBoss.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Boss.tex"));
  _toCounter.SetData_t(CTFILENAME("Textures\\Interface\\HL2_Counter.tex"));

  _atoAmmo[0].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_Pistol.tex"));
  _atoAmmo[1].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_357.tex"));
  _atoAmmo[2].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_SMG1.tex"));
  _atoAmmo[3].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_AR2.tex"));
  _atoAmmo[4].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_SPAS.tex"));
  _atoAmmo[5].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_Crossbow.tex"));
  _atoAmmo[6].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_Grenades.tex"));
  _atoAmmo[7].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_RPG.tex"));
  _atoAmmo[8].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_SMG1.tex"));
  _atoAmmo[9].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_SMG1_Grenades.tex"));
  _atoAmmo[10].SetData_t(CTFILENAME("Textures\\Interface\\Ammo\\HL2_AR2_EnergyBalls.tex"));

  _atoWeapon[0].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Crowbar.tex"));
  _atoWeapon[1].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_GravityGun.tex"));
  _atoWeapon[2].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Pistol.tex"));
  _atoWeapon[3].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_357.tex"));
  _atoWeapon[4].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_SMG1.tex"));
  _atoWeapon[5].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_AR2.tex"));
  _atoWeapon[6].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_SPAS.tex"));
  _atoWeapon[7].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Crossbow.tex"));
  _atoWeapon[8].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\G3SG1.tex"));
  _atoWeapon[9].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Grenade.tex"));
  _atoWeapon[10].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_RPG.tex"));
  _atoWeapon[11].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\SS_Flamer.tex"));
  _atoWeapon[12].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\SS_Laser.tex"));
  _atoWeapon[13].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\SS_Cannon.tex"));

  _atoWeaponGlow[0].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Crowbar_Glow.tex"));
  _atoWeaponGlow[1].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_GravityGun_Glow.tex"));
  _atoWeaponGlow[2].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Pistol_Glow.tex"));
  _atoWeaponGlow[3].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_357_Glow.tex"));
  _atoWeaponGlow[4].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_SMG1_Glow.tex"));
  _atoWeaponGlow[5].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_AR2_Glow.tex"));
  _atoWeaponGlow[6].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_SPAS_Glow.tex"));
  _atoWeaponGlow[7].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Crossbow_Glow.tex"));
  _atoWeaponGlow[8].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\G3SG1_Glow.tex"));
  _atoWeaponGlow[9].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_Grenade_Glow.tex"));
  _atoWeaponGlow[10].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\HL2_RPG_Glow.tex"));
  _atoWeaponGlow[11].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\SS_Flamer_Glow.tex"));
  _atoWeaponGlow[12].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\SS_Laser_Glow.tex"));
  _atoWeaponGlow[13].SetData_t(CTFILENAME("Textures\\Interface\\Weapons\\SS_Cannon_Glow.tex"));

  //((CTextureData*)_toOverlay.GetData())->Force(TEX_CONSTANT);
  //((CTextureData*)_toWeapons.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toHealth.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toSuit.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toAmmo.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toAlt.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toPower.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toOxygen.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toBoss.GetData())->Force(TEX_CONSTANT);
  ((CTextureData*)_toCounter.GetData())->Force(TEX_CONSTANT);

  for (INDEX iAmmo = 0; iAmmo < 11; iAmmo++) {
    ((CTextureData*)_atoAmmo[iAmmo].GetData())->Force(TEX_CONSTANT);
  }

  for (INDEX iWeapon = 0; iWeapon < 14; iWeapon++) {
    ((CTextureData*)_atoWeapon[iWeapon].GetData())->Force(TEX_CONSTANT);
    ((CTextureData*)_atoWeaponGlow[iWeapon].GetData())->Force(TEX_CONSTANT);
    _abWeaponIconColor[iWeapon] = FALSE;
  }

  // [Cecil] Colorful icons
  _abWeaponIconColor[8] = TRUE;
  _abWeaponIconColor[11] = TRUE;
  _abWeaponIconColor[12] = TRUE;
  _abWeaponIconColor[13] = TRUE;
};

void HL2_SetAlpha(UBYTE ub) {
  _ubAlpha = ub;
};

void HL2_SetGlow(BOOL bGlow) {
  _bGlow = bGlow;
};

void HL2_SetGlowAlpha(FLOAT fGlow) {
  if (_bGlow) {
    _ubAlpha = UBYTE(fGlow * 255.0f);
  }
};

void DrawTexture(CTextureObject *pto, FLOAT fX1, FLOAT fY1, FLOAT fX2, FLOAT fY2, COLOR col, UBYTE ubAnchor) {
  AnchorPos(fX1, 640, ubAnchor, TRUE);
  AnchorPos(fX2, 640, ubAnchor, TRUE);
  AnchorPos(fY1, 480, ubAnchor, FALSE);
  AnchorPos(fY2, 480, ubAnchor, FALSE);

  _pdp->InitTexture(pto);
  _pdp->AddTexture(fX1, fY1, fX2, fY2, col);
  _pdp->FlushRenderingQueue();
};

void DrawIcon(CTextureObject *pto, FLOAT fCenterX, FLOAT fCenterY, FLOAT fWidth, FLOAT fHeight, COLOR col, UBYTE ubAnchor) {
  DrawTexture(pto, fCenterX-fWidth/2.0f,          fCenterY-fHeight/2.0f,
                   fCenterX-fWidth/2.0f + fWidth, fCenterY-fHeight/2.0f + fHeight, col, ubAnchor);
  /*FLOAT fX1 = (fCenterX - fWidth/2.0f) * _fResScalingX;
  FLOAT fX2 = (fCenterX + fWidth/2.0f) * _fResScalingX;

  FLOAT fY1 = (fCenterY - fHeight/2.0f);
  FLOAT fY2 = (fCenterY + fHeight/2.0f);

  if (bBottom) {
    fY1 = 480 * _fResScalingY - (480-fY1) * _fResScalingX;
    fY2 = 480 * _fResScalingY - (480-fY2) * _fResScalingX;
  } else {
    fY1 *= _fResScalingX;
    fY2 *= _fResScalingX;
  }

  _pdp->InitTexture(pto);
  _pdp->AddTexture(fX1, fY1, fX2, fY2, col);
  _pdp->FlushRenderingQueue();*/
};

void HL2_DrawHealth(CPlayer *penLast) {
  FLOAT fValue = ceil(ClampDn(_penPlayer->GetHealth(), 0.0f)); // never show negative health
  CTString strValue = "";
  strValue.PrintF("%d", (SLONG)ceil(fValue));

  BOOL bLow = (fValue <= 0.0f);
  COLOR colUI = !bLow ? UI_COL_GLOW(fValue/100) : UI_RED_GLOW;
    
  FLOAT fGlow = InfoUpdate(fValue, penLast->m_iLastHealth, penLast->m_tmHealthChanged);
  HL2_SetGlowAlpha(fGlow);

  FLOAT fBase = 16;

  if (!_bGlow) {
    colUI = !bLow ? UI_COL(fValue/100) : UI_RED;
    HUD_DrawBorder(fBase, 432, 102, 36, UI_BORDER, SAF_BOTTOM);
    DrawTexture(&_toHealth, fBase + 8, 480 - 26, fBase + 8 + 129/3.2f, 480 - 26 + 33/3.2f, colUI|_ubAlpha, SAF_BOTTOM);
  }
  HUD_DrawText(fBase + SHIFT_X - 4*(fValue >= 200), 432 + SHIFT_Y, strValue, colUI|_ubAlpha, -1, SAF_BOTTOM);
};

void HL2_DrawArmor(CPlayer *penLast) {
  FLOAT fValue = ceil(_penPlayer->m_fArmor);

  if (fValue > 0.0f) {
    CTString strValue = "";
    strValue.PrintF("%d", (SLONG)ceil(fValue));

    COLOR colUI = UI_COL_GLOW(fValue/100);
    
    FLOAT fGlow = InfoUpdate(fValue, penLast->m_iLastArmor, penLast->m_tmArmorChanged);
    HL2_SetGlowAlpha(fGlow);

    FLOAT fBase = 140;
    
    if (!_bGlow) {
      colUI = UI_COL(fValue/100);
      HUD_DrawBorder(fBase, 432, 102, 36, UI_BORDER, SAF_BOTTOM);
      DrawTexture(&_toSuit, fBase + 8, 480 - 26, fBase + 8 + 129/3.2f, 480 - 26 + 33/3.2f, UI_COL(1.0f)|_ubAlpha, SAF_BOTTOM);
    }
    HUD_DrawText(fBase + SHIFT_X - 4*(fValue >= 200), 432 + SHIFT_Y, strValue, UI_COL(1.0f)|_ubAlpha, -1, SAF_BOTTOM);
  }
};

void HL2_DrawCurrentWeapon(CPlayer *penLast) {
  const BOOL bInfiniteAlt = (GetSP()->sp_iHL2Flags & HL2F_INFALT);
  INDEX iCurrent = _penWeapons->m_iCurrentWeapon;
  INDEX iPrevious = _penWeapons->m_iPreviousWeapon;

  INDEX iMag = 0;
  INDEX iAmmo = 0;
  INDEX *piMaxMag = _penWeapons->GetMaxAmmo();
  BOOL bMag = FALSE;

  INDEX *piAlt = _penWeapons->GetAltAmmo(iCurrent);
  INDEX *piMaxAlt = _penWeapons->GetMaxAltAmmo(iCurrent);
  BOOL bAlt = (piAlt != NULL && piMaxAlt != NULL);

  // Just ammo
  INDEX *piAmmo = _penWeapons->GetAmmo();
  if (piAmmo != NULL) {
    iMag = *piAmmo;

    // Mag system
    INDEX *piMag = _penWeapons->GetMagPointer();

    if (piMag != NULL) {
      iAmmo = iMag;
      iMag = *piMag;
      piMaxMag = _penWeapons->GetMaxMagPointer();
      bMag = TRUE;
    }
  }

  CTString strMag = "";
  strMag.PrintF("%d", iMag);
  CTString strAmmo = "";
  strAmmo.PrintF("%d", iAmmo);

  BOOL bLow = FALSE;
  COLOR colUI = UI_COL_GLOW(1.0f);

  FLOAT tmWeapon = Clamp(_pTimer->GetLerpedCurrentTick() - _penPlayer->m_tmWeaponChange, 0.0f, 1.0f);
  FLOAT tmAltShift = 0.0f;

  if (piAlt != NULL) {
    // This and previous weapons have alt ammo (and already changed)
    if (_penWeapons->GetAltAmmo(iPrevious) != NULL) {
      tmAltShift = 1.0f;

    // This weapon has alt ammo and the previous one doesn't
    } else {
      tmAltShift = Clamp((_pTimer->GetLerpedCurrentTick() - _penPlayer->m_tmWeaponChange)*3.0f, 0.0f, 1.0f);
    }

  // Previous weapon had alt ammo and this one doesn't
  } else if (_penWeapons->GetAltAmmo(iPrevious) != NULL) {
    tmAltShift = Clamp((_penPlayer->m_tmWeaponChange - _pTimer->GetLerpedCurrentTick())*3.0f + 1.0f, 0.0f, 1.0f);
  }

  COLOR colBorder = LerpColor(UI_COL(1.0f)|0x7F, UI_BORDER, tmWeapon);
    
  FLOAT fGlow = 0.0f;
  FLOAT fBase = 492;
  FLOAT fAltShift = (bInfiniteAlt * 28.0f);

  // Alt Ammo
  if (bAlt) {
    bLow = (*piAlt <= 0);
    colUI = !bLow ? UI_COL_GLOW(FLOAT(*piAlt)/FLOAT(*piMaxAlt)) : UI_RED_GLOW;

    if (bInfiniteAlt) {
      colUI = UI_COL_GLOW(1.0f);
    }

    if (!_bGlow) {
      colUI = !bLow ? UI_COL(FLOAT(*piAlt)/FLOAT(*piMaxAlt)) : UI_RED;

      if (bInfiniteAlt) {
        colUI = UI_COL(1.0f);
      }

      HUD_DrawBorder(fBase+72 + fAltShift, 432, 60 - fAltShift, 36, colBorder, SAF_BOTTOM|SAF_RIGHT);
      DrawTexture(&_toAlt, fBase+72 + fAltShift + 8, 480 - 26, fBase+72 + fAltShift + 8 + 65/3.2f, 480 - 26 + 33/3.2f, colUI|_ubAlpha, SAF_BOTTOM|SAF_RIGHT);

      // Alt ammo icon
      INDEX iAltAmmoIndex = _awiWeapons[iCurrent].wi_iAltAmmo;
      if (iAltAmmoIndex != -1) {
        DrawIcon(&_atoAmmo[iAltAmmoIndex], fBase+72 + fAltShift + 14, 432+13, 128/3.2f, 64/3.2f, colUI|_ubAlpha, SAF_BOTTOM|SAF_RIGHT);
      }
    }

    fGlow = InfoUpdate(*piAlt, penLast->m_iLastAlt, penLast->m_tmAltChanged);
    HL2_SetGlowAlpha(fGlow);

    if (!bInfiniteAlt) {
      CTString strAlt;
      strAlt.PrintF("%d", *piAlt);
      HUD_DrawText(fBase+72 + fAltShift + 52, 432 + SHIFT_Y, strAlt, colUI|_ubAlpha, 1, SAF_BOTTOM|SAF_RIGHT);
    }
  }

  bLow = (iMag <= 0);
  colUI = !bLow ? UI_COL_GLOW(FLOAT(iMag)/FLOAT(*piMaxMag)) : UI_RED_GLOW;

  fGlow = InfoUpdate(iMag, penLast->m_iLastAmmo, penLast->m_tmAmmoChanged);
  HL2_SetGlowAlpha(fGlow);

  BOOL bInfinite = (!bMag && GetSP()->sp_bInfiniteAmmo);
  FLOAT fInfiniteShift = (bInfinite * 88.0f);

  fBase = 492.0f - ((74.0f - fAltShift) * tmAltShift) + fInfiniteShift;

  // Ammo
  if (!_bGlow && GetSP()->sp_iHLGamemode != HLGM_DISSOLVE) {
    colUI = !bLow ? UI_COL(FLOAT(iMag)/FLOAT(*piMaxMag)) : UI_RED;

    HUD_DrawBorder(fBase, 432, 132 - fInfiniteShift, 36, colBorder, SAF_BOTTOM|SAF_RIGHT);
    DrawTexture(&_toAmmo, fBase + 8, 480 - 26, fBase + 8 + 129/3.2f, 480 - 26 + 33/3.2f, colUI|_ubAlpha, SAF_BOTTOM|SAF_RIGHT);

    // Ammo icon
    INDEX iAmmoIndex = _awiWeapons[iCurrent].wi_iAmmo;
    if (iAmmoIndex != -1) {
      DrawIcon(&_atoAmmo[iAmmoIndex], fBase + 20, 432+13, 128/3.2f, 64/3.2f, colUI|_ubAlpha, SAF_BOTTOM|SAF_RIGHT);
    }

    if (bMag) {
      // Show max mag instead of ammo
      if (GetSP()->sp_bInfiniteAmmo) {
        strAmmo.PrintF("%d", *piMaxMag);
      }

      SetTextSize(_pdp, TRUE);
      HUD_DrawText(fBase + SHIFT_X + 48, 432 + SHIFT_Y + 18, strAmmo, colUI|_ubAlpha, -1, SAF_BOTTOM|SAF_RIGHT);
      SetTextSize(_pdp, FALSE);
    }
  }

  if (!bInfinite && GetSP()->sp_iHLGamemode != HLGM_DISSOLVE) {
    HUD_DrawText(fBase + SHIFT_X - 8, 432 + SHIFT_Y, strMag, colUI|_ubAlpha, -1, SAF_BOTTOM|SAF_RIGHT);
  }
};

void HL2_DrawWeaponScroll(CPlayer *penLast) {
  /*_pdp->InitTexture(&_toWeapons);
  _pdp->AddTexture(0, 0, 640*_fResScalingX, 320*_fResScalingY, 0xFFFFFF7F);
  _pdp->FlushRenderingQueue();*/

  // Render time
  FLOAT tmWeapon = (_pTimer->GetLerpedCurrentTick() - _penPlayer->m_tmWeaponChange);

  if (tmWeapon > 1.0f) {
    return;
  }

  // Alpha
  FLOAT fAlpha = 1.0f - Clamp(tmWeapon*2.0f - 1.5f, 0.0f, 1.0f);

  // Current weapon
  WeaponType eCurrent = _penWeapons->m_iCurrentWeapon;
  INDEX iCurIndex = _penWeapons->GetSelectedWeapon(eCurrent);

  // List of weapons under specific number
  CStaticArray<INDEX> aiWeapons;
  ULONG ulLists = 0;

  for (INDEX iRemap = 1; iRemap < 19; iRemap++) {
    INDEX ct = aiWeapons.Count();
    WeaponType eWeaponFill = (WeaponType)_aiWeaponsRemap[iRemap];
    INDEX iWeaponNumber = _penWeapons->GetSelectedWeapon(eWeaponFill);

    if (WeaponExists(_penWeapons->m_iAvailableWeapons, eWeaponFill)) {
      // This weapon is in the selected list
      if (iWeaponNumber == iCurIndex) {
        aiWeapons.Expand(ct+1);
        aiWeapons[ct] = eWeaponFill;
      }

      // This list has weapons
      ulLists |= (1 << (iWeaponNumber-1));
    }
  }

  FLOAT fWeaponX = 162;
  FLOAT fWeaponY = 16;

  const FLOAT fSizeX = 116;
  const FLOAT fSizeY = 80;

  for (INDEX iList = 0; iList < 6; iList++) {
    if (!(ulLists & (1 << iList))) {
      continue;
    }

    COLOR colBorder = (UI_BORDER & 0xFFFFFF00) | UBYTE(FLOAT(UI_BORDER & 0xFF) * fAlpha);
    UBYTE ubNormalAlpha = UBYTE(FLOAT(0xFF) * fAlpha);

    // Selected weapon list
    if (iList == iCurIndex-1) {
      _pdp->SetFont(_pfdConsoleFont);
      _pdp->SetTextScaling(1.0f);
      _pdp->SetTextAspect(1.0f);

      for (INDEX iListWeapon = 0; iListWeapon < aiWeapons.Count(); iListWeapon++) {
        HUD_DrawBorder(fWeaponX, fWeaponY, fSizeX, fSizeY, colBorder, 0);

        BOOL bAmmo = (_penWeapons->GetAmmo(aiWeapons[iListWeapon]) > 0
                   || _penWeapons->GetMagCount(aiWeapons[iListWeapon]) > 0
                   || _penWeapons->GetAltAmmoCount(aiWeapons[iListWeapon]) > 0);

        COLOR colNormal = (bAmmo ? UI_COL(1.0f) : (UI_RED & 0xFFFFFF00));

        INDEX iWeaponInList = _penWeapons->FindRemapedPos((WeaponType)aiWeapons[iListWeapon]);

        // Weapon icons
        if (iWeaponInList >= 1 && iWeaponInList <= 14) {
          if (eCurrent == aiWeapons[iListWeapon]) {
            DrawTexture(&_atoWeaponGlow[iWeaponInList-1], fWeaponX, fWeaponY+fSizeY/2.0f - fSizeX/2.0f, fWeaponX+fSizeX, fWeaponY+fSizeY/2.0f + fSizeX/2.0f, colNormal|ubNormalAlpha, 0);
          }

          COLOR colWeapon = (_abWeaponIconColor[iWeaponInList-1] ? 0xFFFFFF00 : colNormal);
          DrawTexture(&_atoWeapon[iWeaponInList-1], fWeaponX, fWeaponY+fSizeY/2.0f - fSizeX/2.0f, fWeaponX+fSizeX, fWeaponY+fSizeY/2.0f + fSizeX/2.0f, colWeapon|ubNormalAlpha, 0);
        }

        if (eCurrent == aiWeapons[iListWeapon]) {
          HUD_DrawText(fWeaponX+fSizeX/2.0f, fWeaponY+fSizeY - 12.0f, _astrWeaponName[iWeaponInList-1][0], UI_COL(1.0f)|ubNormalAlpha, 0, 0);
          HUD_DrawText(fWeaponX+fSizeX/2.0f, fWeaponY+fSizeY - 6.0f, _astrWeaponName[iWeaponInList-1][1], UI_COL(1.0f)|ubNormalAlpha, 0, 0);
        }

        fWeaponY += fSizeY + 8;
      }
    } else {
      // Weapon list
      HUD_DrawBorder(fWeaponX, fWeaponY, 32, 32, colBorder, 0);
    }

    fWeaponY = 16;

    // List number
    _pdp->SetFont(_pfdDisplayFont);
    _pdp->SetTextScaling(_fResScalingY);
    _pdp->SetTextAspect(1.0f);
    HUD_DrawText(fWeaponX+4, fWeaponY+4, CTString(0, "%d", iList+1), UI_COL(1.0f)|ubNormalAlpha, -1, 0);

    if (iList == iCurIndex-1) {
      fWeaponX += fSizeX + 8;
    } else {
      fWeaponX += 32 + 8;
    }
  }
};

void HL2_DrawBars(void) {
  // oxygen power
  FLOAT fHolding = (_pTimer->GetLerpedCurrentTick()-0.1f - _penPlayer->en_tmLastBreathed);
  FLOAT fUnderwater = (_penPlayer->en_tmMaxHoldBreath - fHolding);

  FLOAT fAnim = Clamp(fHolding*3.0f, 0.0f, 1.0f);

  if (_penPlayer->IsConnected() && (_penPlayer->GetFlags() & ENF_ALIVE) && fUnderwater < 60.0f) {
    FLOAT fNormValue = ClampDn(fUnderwater / _penPlayer->en_tmMaxHoldBreath, 0.0f);

    INDEX iMode = 1; // Oxygen (TEMP)
    FLOAT fShift = 10.0f * fAnim;
    UBYTE ubAlpha = UBYTE(fAnim*255.0f);

    COLOR colBorder = (UI_BORDER & 0xFFFFFF00) | UBYTE(fAnim * FLOAT(UI_BORDER & 0xFF));
    COLOR colNormal = (fNormValue > 0.2f) ? UI_COL(1.0f) : (UI_RED & 0xFFFFFF00);

    HUD_DrawBorder(16, 400-fShift, 102, 26+fShift, colBorder, SAF_BOTTOM);
    HUD_DrawBar(16+8, 400-fShift+15, 6, 4, 3, 10, colNormal|ubAlpha, colNormal|UBYTE(fAnim * 159.0f), fNormValue, SAF_BOTTOM);
    DrawTexture(&_toPower, 16+8, 400-fShift+6, 16+8 + 256/3.2f, 400-fShift+6 + 32/3.2f, colNormal|ubAlpha, SAF_BOTTOM);

    switch (iMode) {
      case 1:
        DrawTexture(&_toOxygen, 16+8, 400-fShift+23, 16+8 + 128/3.2f, 400-fShift+23 + 32/3.2f, colNormal|ubAlpha, SAF_BOTTOM);
        break;
    }
  }

  // draw boss energy if needed
  if (_penPlayer->m_penMainMusicHolder != NULL) {
    CMusicHolder &mh = (CMusicHolder&)*_penPlayer->m_penMainMusicHolder;
    FLOAT fValue = 0.0f;
    FLOAT fNormValue = 0.0f;
    BOOL bCounter = FALSE;

    if (mh.m_penBoss != NULL && (mh.m_penBoss->en_ulFlags & ENF_ALIVE)) {
      CEnemyBase &eb = (CEnemyBase&)*mh.m_penBoss;
      fValue = eb.GetHealth();
      fNormValue = fValue/eb.m_fMaxHealth;
    }

    if (mh.m_penCounter != NULL) {
      CEnemyCounter &ec = (CEnemyCounter&)*mh.m_penCounter;

      if (ec.m_iCount > 0) {
        fValue = ec.m_iCount;
        fNormValue = fValue/ec.m_iCountFrom;
        bCounter = TRUE;
      }
    }

    // prepare and draw boss energy info
    if (fNormValue > 0) {
      COLOR colNormal = (fNormValue > 0.2f) ? UI_COL(1.0f) : (UI_RED & 0xFFFFFF00);

      HUD_DrawBorder(320-128, 12, 256, 26, UI_BORDER, SAF_CENTER);
      HUD_DrawBar(320-128+8, 12+15, 6, 4, 2, 30, colNormal|0xFF, colNormal|0x9F, fNormValue, SAF_CENTER);

      if (bCounter) {
        DrawTexture(&_toCounter, 320-128+8, 12+6, 320-128+8 + 256/3.2f, 12+6 + 32/3.2f, colNormal|0xFF, SAF_CENTER);
      } else {
        DrawTexture(&_toBoss, 320-128+8, 12+6, 320-128+8 + 128/3.2f, 12+6 + 32/3.2f, colNormal|0xFF, SAF_CENTER);
      }
    }
  }
};