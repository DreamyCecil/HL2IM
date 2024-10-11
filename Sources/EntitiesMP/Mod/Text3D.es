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

5008
%{
#include "StdH.h"

#include <EntitiesMP/Cecil/Text3DParticles.h>
%}

enum ETextTagMode {
  0 TTM_PRINT  "Print as is",     // i.e. "^cff0000Text" in default color
  1 TTM_IGNORE "Ignore and skip", // i.e. "Text" in default color
  2 TTM_APPLY  "Apply",           // i.e. "Text" in red color
};

// Matches ParticleBlendType
enum ETextBlendType {
  0 TBT_BLEND       "Blend",
  1 TBT_ADD         "Add",
  2 TBT_MULTIPLY    "Multiply",
  3 TBT_ADDALPHA    "Add Alpha",
  4 TBT_FLEX        "Flex",
  5 TBT_TRANSPARENT "Transparent",
};

enum ETextAnchorX {
  0 TAX_LEFT   "0 Left",
  1 TAX_CENTER "1 Center",
  2 TAX_RIGHT  "2 Right",
};

enum ETextAnchorY {
  0 TAY_TOP    "0 Top",
  1 TAY_CENTER "1 Center",
  2 TAY_BOTTOM "2 Bottom",
};

class CCecilText3D : CEntity {
name      "Text3D";
thumbnail "Thumbnails\\Marker.tbn";
features  "HasName", "IsTargetable";

properties:
  1 CTString m_strName "Name" = "Text3D",

 10 CTString m_strText   "Display Text" = "Text",
 11 COLOR m_colDefault   "Default Color" = 0xFFFFFFFF,
 12 CTFileName m_fnmFont "Display Font" = CTString("Fonts\\Display3-narrow.fnt"),
 13 enum ETextTagMode m_eTagMode "Text Tags" = TTM_APPLY,
 14 FLOAT m_fRenderDist  "Render Distance" = -1.0f,
 15 FLOAT m_fFadeOutDist "Render Fade Out" = 1.0f,
 16 FLOAT m_fOffsetZ     "Z Offset" = 0.01f,

 20 enum BoolEType m_betFixed "Fixed Width" = BET_IGNORE,
 21 FLOAT m_fScaling     "Text Scaling" = 1.0f,
 22 FLOAT m_fAspect      "Text Aspect" = 1.0f,
 23 FLOAT m_fCharSpacing "Text Char Spacing" = 0.0f,
 24 FLOAT m_fLineSpacing "Text Line Spacing" = 0.0f,

 30 CTString m_strLineBreak "Line Break Sequence" = "%n",
 31 enum ETextAnchorX m_eAnchorX "Text Anchor X" = TAX_LEFT,
 32 enum ETextAnchorY m_eAnchorY "Text Anchor Y" = TAY_TOP,
 33 enum ETextBlendType m_eBlendType "Text Blending" = TBT_BLEND,

{
  CFontData m_fdFontLoaded;
  CFontData *m_pfdFontRender;
  CTextureObject m_toFontTexture;
  CText3DEffects m_aEffects;
}

components:
  1 model   MODEL_MARKER   "Models\\Editor\\Axis.mdl",
  2 texture TEXTURE_MARKER "ModelsMP\\Editor\\Debug_EntityStack.tex"

functions:
  // Constructor
  void CCecilText3D(void) {
    m_pfdFontRender = _pfdDisplayFont;
    m_toFontTexture.SetData(m_pfdFontRender->fd_ptdTextureData);
  };

  virtual void Read_t(CTStream *istr) {
    CEntity::Read_t(istr);
    SetupText();
  };

  virtual void RenderParticles(void) {
    SText3D t3d;
    t3d.pfdFont = m_pfdFontRender;
    t3d.ptoFont = &m_toFontTexture;

    // Set fixed width
    if (m_betFixed != BET_IGNORE) {
      t3d.bFixedWidth = (m_betFixed != BET_FALSE);
    } else {
      t3d.bFixedWidth = t3d.pfdFont->IsFixedWidth();
    }

    // Set text properties
    t3d.fScaling = m_fScaling;
    t3d.fAspect = m_fAspect;
    t3d.iTagMode = GetTagModeFromEnum();
    t3d.fCharSpacing = m_fCharSpacing;
    t3d.fLineSpacing = m_fLineSpacing;

    t3d.colDefault = m_colDefault;
    t3d.fRenderDistance = m_fRenderDist;
    t3d.fRenderFadeOutDistance = m_fFadeOutDist;

    CPlacement3D plPos(FLOAT3D(0, 0, m_fOffsetZ), ANGLE3D(0, 0, 0));
    plPos.RelativeToAbsoluteSmooth(GetLerpedPlacement());

    Particles_Text3D(t3d, plPos, m_aEffects, GetAnchorFromEnumX(), GetAnchorFromEnumY(), (ParticleBlendType)m_eBlendType);
  };

  INDEX GetTagModeFromEnum(void) {
    return (m_eTagMode - 1); // -1, 0, +1
  };

  INDEX GetAnchorFromEnumX(void) {
    return (m_eAnchorX - 1); // -1, 0, +1
  };

  INDEX GetAnchorFromEnumY(void) {
    return (m_eAnchorY - 1); // -1, 0, +1
  };

  // Load new font with its texture
  void SetupText(void) {
    // Try loading the font
    BOOL bLoaded = FALSE;

    if (m_fnmFont != "") {
      try {
        m_fdFontLoaded.Load_t(m_fnmFont);
        m_pfdFontRender = &m_fdFontLoaded;
        bLoaded = TRUE;

      } catch (char *strError) {
        WarningMessage("Cannot load '%s' font for Text3D: %s", m_fnmFont.str_String, strError);
      }
    }

    // Set default font
    if (!bLoaded) {
      m_fnmFont = CTString("");
      m_pfdFontRender = _pfdDisplayFont;
    }

    // Set font texture
    m_toFontTexture.SetData(m_pfdFontRender->fd_ptdTextureData);

    // Replace line break sequence with actual line breaks
    CTString strText = m_strText;

    if (m_strLineBreak != "") {
      while (strText.ReplaceSubstr(m_strLineBreak, "\n")) {};
    }

    // Parse text effects
    ParseStringWithTags(strText, GetTagModeFromEnum(), m_colDefault, m_aEffects);
  };

procedures:
  Main() {
    InitAsEditorModel();
    SetPhysicsFlags(EPF_MODEL_IMMATERIAL);
    SetCollisionFlags(ECF_IMMATERIAL);

    SetModel(MODEL_MARKER);
    SetModelMainTexture(TEXTURE_MARKER);

    SetupText();
    return;
  };
};
