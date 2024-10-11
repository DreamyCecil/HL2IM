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

#ifndef CECIL_INCL_TEXT3DPARTICLES_H
#define CECIL_INCL_TEXT3DPARTICLES_H

#ifdef PRAGMA_ONCE
  #pragma once
#endif

// Text effects per character
struct SCharEffects {
  UBYTE ubChar; // Character code

  COLOR colBlend; // ^c & ^a
  INDEX iFlash;   // ^f (0 - disable; 1..19)
  BOOL bBold;     // ^b
  BOOL bItalic;   // ^i

  SCharEffects() : ubChar('\0') {
    Reset(0xFFFFFFFF);
  };

  // Set to the default state
  inline void Reset(COLOR colDefault) {
    colBlend = colDefault;
    iFlash = 0;
    bBold = FALSE;
    bItalic = FALSE;
  };

  // Set new color without replacing alpha channel
  inline void SetColor(COLOR colSetColor) {
    colBlend = (colSetColor & 0xFFFFFF00) | (colBlend & 0x000000FF);
  };

  // Set alpha channel from another color
  inline void SetAlpha(COLOR colSetAlpha) {
    colBlend = (colBlend & 0xFFFFFF00) | (colSetAlpha & 0x000000FF);
  };
};

typedef CStaticStackArray<SCharEffects> CText3DEffects;

// 3D text properties
struct SText3D {
  CFontData *pfdFont;
  CTextureObject *ptoFont;

  // Text properties
  BOOL bFixedWidth;
  FLOAT fScaling;
  FLOAT fAspect;
  INDEX iTagMode;
  FLOAT fCharSpacing;
  FLOAT fLineSpacing;

  // Rendering properties
  COLOR colDefault;
  FLOAT fRenderDistance;
  FLOAT fRenderFadeOutDistance;

  SText3D() {
    pfdFont = NULL;
    ptoFont = NULL;

    bFixedWidth = FALSE;
    fScaling = 1.0f;
    fAspect = 1.0f;
    iTagMode = 1;
    fCharSpacing = 0.0f;
    fLineSpacing = 0.0f;

    colDefault = C_WHITE | CT_OPAQUE;
    fRenderDistance = -1.0f;
    fRenderFadeOutDistance = 1.0f;
  };
};

// Fill an array of characters with specific effects by parsing a string with tags
void ParseStringWithTags(const CTString &strText, INDEX iTagMode, COLOR colDefault, CText3DEffects &aEffects);

// Display 3D text in the world from a pre-determined array of characters with effects
void Particles_Text3D(SText3D t3d, const CPlacement3D &plPos, const CText3DEffects &aEffects,
  INDEX iAnchorX, INDEX iAnchorY, ParticleBlendType eBlendMode);

// Display 3D text in the world from a regular string
void Particles_Text3D(SText3D t3d, const CPlacement3D &plPos, const CTString &strText, INDEX iTagMode,
  INDEX iAnchorX, INDEX iAnchorY, ParticleBlendType eBlendMode);

#endif
