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

#include <Engine/Graphics/DrawPort.h>

#include <EntitiesMP/Player.h>
#include <EntitiesMP/PlayerWeapons.h>

// UI Colors
#define _UI_COL      GetUIColor(hl2_colUIMain)     // Def: 0xFFE30000
#define _UI_COL_GLOW (hl2_colUIMain  & 0xFFFFFF00) // Def: 0xFFFF0000
#define _UI_RED_FADE (hl2_colUIEmpty & 0xFFFFFF00) // Def: 0xFF000000
#define UI_BORDER    (hl2_colUIBorder)             // Def: 0x0000003F

#define UI_RED      _UI_RED_FADE|0xFF
#define UI_RED_GLOW _UI_RED_FADE

#define UI_COL(ratio)      LerpColor(_UI_RED_FADE, _UI_COL,      Clamp(ratio, 0.0f, 1.0f) * 0.33f + 0.67f)
#define UI_COL_GLOW(ratio) LerpColor(_UI_RED_FADE, _UI_COL_GLOW, Clamp(ratio, 0.0f, 1.0f) * 0.33f + 0.67f)

inline COLOR GetUIColor(INDEX iColor) {
  COLOR col = iColor;

  UBYTE ubH, ubS, ubV;
  ColorToHSV(col, ubH, ubS, ubV);

  // Shift hue by 4 backwards
  ubH = (UBYTE)((ULONG(ubH) + 252) % 256);

  return HSVToColor(ubH, ubS, ubV);
};

inline BOOL PointBox(FLOAT3D vPoint, FLOAT2D vPos, FLOAT2D vSize) {
  return (vPoint(1) >= vPos(1) && vPoint(2) >= vPos(2) && vPoint(1) < vPos(1)+vSize(1) && vPoint(2) < vPos(2)+vSize(2));
};

// Screen anchor
#define SAF_BOTTOM (1 << 0)
#define SAF_RIGHT  (1 << 1)
#define SAF_CENTER (1 << 2)

#define SAF_HOR_MASK SAF_RIGHT|SAF_CENTER
#define SAF_VER_MASK SAF_BOTTOM

void AnchorPos(FLOAT &fPos, FLOAT fLimit, UBYTE ubFlags, BOOL bHor);

// String with only color codes
CTString StringWithColors(const CTString &str);
// Word wrap for a string
INDEX WordWrap(CDrawPort *pdp, CTString &strText, FLOAT fWidth);

void HL2_UIInit(void);
void HL2_SetAlpha(UBYTE ub);
void HL2_SetGlow(BOOL bGlow);
void HL2_SetGlowAlpha(FLOAT fGlow);

void DrawTexture(CTextureObject *pto, FLOAT fX1, FLOAT fY1, FLOAT fX2, FLOAT fY2, COLOR col, UBYTE ubAnchor);
void DrawIcon(CTextureObject *pto, FLOAT fCenterX, FLOAT fCenterY, FLOAT fWidth, FLOAT fHeight, COLOR col, UBYTE ubAnchor);

void HL2_DrawHealth(CPlayer *penLast);
void HL2_DrawArmor(CPlayer *penLast);
void HL2_DrawCurrentWeapon(CPlayer *penLast);
void HL2_DrawWeaponScroll(CPlayer *penLast);
void HL2_DrawBars(void);

// Exports from HUD.cpp

// weapons' info structure
struct WeaponInfo {
  enum WeaponType  wi_wtWeapon;
  INDEX wi_iAmmo; // [Cecil] Ammo Index
  INDEX wi_iAltAmmo; // [Cecil] Alt Ammo Index
  BOOL wi_bHasWeapon;
};

FLOAT InfoUpdate(const INDEX &iCurrentValue, INDEX &iLastValue, TIME &tmChanged);
void SetGlobalUI(CDrawPort *pdp);
void GetScaling(FLOAT &fX, FLOAT &fY);
void SetTextSize(CDrawPort *pdp, BOOL bSmall);

void HUD_DrawBorder(FLOAT fX, FLOAT fY, FLOAT fSizeX, FLOAT fSizeY, COLOR colTiles, UBYTE ubAnchor);
void HUD_DrawText(FLOAT fX, FLOAT fY, const CTString &strText, COLOR col, const INDEX &iType, UBYTE ubAnchor);
void HUD_DrawBar(FLOAT fX, FLOAT fY, FLOAT fSizeX, FLOAT fSizeY, FLOAT fSpacing, INDEX iParts, COLOR colActive, COLOR colPassive, FLOAT fValue, UBYTE ubAnchor);
