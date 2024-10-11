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

#include "Text3DParticles.h"

// Current player projection
extern CAnyProjection3D prPlayerProjection;

// Cached values for 3D text
static FLOAT _fCellWidth;
static FLOAT _fCellHeight;
static FLOAT _fScalingX;
static FLOAT _fScalingY;

static FLOAT _fCorrectionU;
static FLOAT _fCorrectionV;
static TIME _tmText3D;

static FLOAT2D _vCharPos;
static FLOAT2D _vTextSize;
static FLOAT _fAdvancer;

// Text effects to parse
static const CText3DEffects *_paEffects;

// Arrays of quad particle positions per character
static CStaticArray<FLOAT3D> _avQuadPos[4];

// Fill an array of characters with specific effects by parsing a string with tags
void ParseStringWithTags(const CTString &strText, INDEX iTagMode, COLOR colDefault, CText3DEffects &aEffects) {
  aEffects.PopAll();

  const INDEX ct = strText.Length();
  if (ct == 0) return;

  // Temporary variables
  char acTmp[7];
  char *pcDummy;
  INDEX iRet;

  SCharEffects cfxCurrent;
  cfxCurrent.Reset(colDefault);

  ASSERT(iTagMode == -1 || iTagMode == 0 || iTagMode == 1);
  const BOOL bApplyTags = (iTagMode == 1);

  for (INDEX i = 0; i < ct; i++) {
    // Get current character
    UBYTE ubCurrent = strText[i];

    // Ignore tabs
    if (ubCurrent == '\t') {
      continue;

    // Encountered a special character and it should be parsed
    } else if (ubCurrent == '^' && iTagMode != -1) {
      // Get next character
      ubCurrent = strText[++i];

      switch (ubCurrent) {
        // Change color
        case 'c': {
          const char *pchFrom = &strText[i + 1];
          strncpy(acTmp, pchFrom, 6);
          iRet = FindZero((UBYTE *)pchFrom, 6);

          i += iRet;
          if (iRet < 6) { break; }

          acTmp[6] = '\0'; // Terminate string
          COLOR col = strtoul(acTmp, &pcDummy, 16) << 8;

          // Keep alpha
          if (bApplyTags) {
            cfxCurrent.SetColor(col);
          }
        } continue;

        // Change alpha
        case 'a': {
          const char *pchFrom = &strText[i + 1];
          strncpy(acTmp, pchFrom, 2);
          iRet = FindZero((UBYTE *)pchFrom, 2);

          i += iRet;
          if (iRet < 2) { break; }

          acTmp[2] = '\0'; // Terminate string
          UBYTE ubAlpha = strtoul(acTmp, &pcDummy, 16);

          // Keep color
          if (bApplyTags) {
            cfxCurrent.SetAlpha(ubAlpha);
          }
        } continue;

        // Flashing
        case 'f': {
          ubCurrent = strText[++i];

          if (bApplyTags) {
            cfxCurrent.iFlash = 1 + 2 * Clamp(INDEX(ubCurrent - '0'), (INDEX)0, (INDEX)9);
          }
        } continue;

        // Reset all effects
        case 'r': if (bApplyTags) cfxCurrent.Reset(colDefault); continue;

        case 'o': continue; // Ignore this code
        case 'b': if (bApplyTags) cfxCurrent.bBold   = TRUE; continue;
        case 'i': if (bApplyTags) cfxCurrent.bItalic = TRUE; continue;

        case 'C': if (bApplyTags) cfxCurrent.SetColor(colDefault); continue;
        case 'A': if (bApplyTags) cfxCurrent.SetAlpha(colDefault); continue;
        case 'F': if (bApplyTags) cfxCurrent.iFlash   = 0; continue;
        case 'B': if (bApplyTags) cfxCurrent.bBold    = FALSE; continue;
        case 'I': if (bApplyTags) cfxCurrent.bItalic  = FALSE; continue;

        default: break;
      }

      // Display ^ as is on ^^ sequence, otherwise stop parsing the string
      if (ubCurrent != '^') {
        i--;
        break;
      }
    }

    cfxCurrent.ubChar = ubCurrent;
    aEffects.Push() = cfxCurrent;
  }
};

// Replacement for the Particle_SetTexturePart() function from TSE 1.07
inline void SetTexturePartDirectUV(const FLOATaabbox2D &boxUV) {
#ifdef NDEBUG
  static UBYTE *pEngine = reinterpret_cast<UBYTE *>(GetModuleHandleA("Engine.dll"));
  static GFXTexCoord *_atex = reinterpret_cast<GFXTexCoord *>(pEngine + 0x1F6490);
#else
  static UBYTE *pEngine = reinterpret_cast<UBYTE *>(GetModuleHandleA("EngineD.dll"));
  static GFXTexCoord *_atex = reinterpret_cast<GFXTexCoord *>(pEngine + 0x4243A8);
#endif

  // Prepare coordinates of the rectangle
  _atex[0].s = boxUV.Min()(1);
  _atex[0].t = boxUV.Min()(2);
  _atex[1].s = boxUV.Min()(1);
  _atex[1].t = boxUV.Max()(2);
  _atex[2].s = boxUV.Max()(1);
  _atex[2].t = boxUV.Max()(2);
  _atex[3].s = boxUV.Max()(1);
  _atex[3].t = boxUV.Min()(2);
};

// Setup 3D text before rendering it
static BOOL SetupText3D(const FLOAT3D &vRenderPos, SText3D &t3d) {
  // No font
  if (t3d.pfdFont == NULL || t3d.ptoFont == NULL) return FALSE;

  // Scaling is too small
  if (Abs(t3d.fScaling) < 0.001f || Abs(t3d.fAspect) < 0.001f) return FALSE;

  COLOR &col = t3d.colDefault;

  // Limit render distance in-game
  if (t3d.fRenderDistance >= 0.0f && IsPlayingGame() && (CProjection3D *)prPlayerProjection != NULL) {
    // Calculate render distance relative to the player view
    const FLOAT3D vViewPos = prPlayerProjection->pr_vViewerPosition;
    const FLOAT fPastRenderDist = ((vViewPos - vRenderPos).Length() - t3d.fRenderDistance);

    // Outside render distance
    const FLOAT fFadeOutDist = t3d.fRenderFadeOutDistance;
    if (fPastRenderDist > fFadeOutDist) return FALSE;

    FLOAT fFadeRatio = 0.0f;

    if (fFadeOutDist > 0.01f) {
      fFadeRatio = ClampDn(fPastRenderDist / fFadeOutDist, 0.0f);
    }

    // Fully faded out
    if (fFadeRatio >= 1.0f) return FALSE;

    // Fade out the further away it is
    const UBYTE ubAlpha = (col & 0xFF) * (1.0f - fFadeRatio);
    col = (col & 0xFFFFFF00) | ubAlpha;
  }

  // Text is fully transparent
  if ((col & 0xFF) == 0) return FALSE;

  // Cache character dimensions
  _fCellWidth  = t3d.pfdFont->fd_pixCharWidth;
  _fCellHeight = t3d.pfdFont->fd_pixCharHeight;
  _fScalingX = t3d.fScaling * t3d.fAspect; // Multiply by the additional aspect
  _fScalingY = t3d.fScaling * (_fCellHeight / _fCellWidth); // Multiply by the character cell aspect

  // Cache UV correction factor
  _fCorrectionU = 1.0f / (FLOAT)t3d.pfdFont->fd_ptdTextureData->GetPixWidth();
  _fCorrectionV = 1.0f / (FLOAT)t3d.pfdFont->fd_ptdTextureData->GetPixHeight();
  _tmText3D = _pTimer->GetLerpedCurrentTick();

  // Current position
  _vCharPos = FLOAT2D(0, 0);
  _vTextSize = FLOAT2D(0, 0);
  _fAdvancer = _fScalingX + t3d.fCharSpacing;

  return TRUE;
};

// Calculate quad positions for the current character
static void DetermineCharPositions(INDEX iChar, const SText3D &t3d) {
  const SCharEffects &cfx = (*_paEffects)[iChar];

  // Go to the next line
  if (cfx.ubChar == '\n') {
    _vCharPos(1) = 0.0f;
    _vCharPos(2) += _fScalingY + t3d.fLineSpacing;
    return;
  }

  // Get character offsets
  const CFontCharData &fcd = t3d.pfdFont->fd_fcdFontCharData[cfx.ubChar];
  const FLOAT fCharStart = fcd.fcd_pixStart;
  const FLOAT fCharEnd = fcd.fcd_pixEnd;

  // Character width in meters
  const FLOAT fCharWidth = (fCharEnd - fCharStart) * _fScalingX / _fCellWidth;

  // Adjusted X coordinate in meters
  FLOAT fXAdjusted = _vCharPos(1) - fCharStart * _fScalingX / _fCellWidth;

  // Center it for the fixed font
  if (t3d.bFixedWidth) {
    fXAdjusted += (_fScalingX - fCharWidth) * 0.5f;

  // Calculate advancer based on character width for the proportional font
  } else {
    _fAdvancer = fCharWidth + t3d.fCharSpacing;
  }

  // Prepare world coordinates
  const FLOAT fX0 = fXAdjusted;
  const FLOAT fX1 = fX0 + _fScalingX;
  const FLOAT fY0 = _vCharPos(2);
  const FLOAT fY1 = fY0 + _fScalingY;

  _avQuadPos[0][iChar] = FLOAT3D(fX0, -fY0, 0);
  _avQuadPos[1][iChar] = FLOAT3D(fX0, -fY1, 0);
  _avQuadPos[2][iChar] = FLOAT3D(fX1, -fY1, 0);
  _avQuadPos[3][iChar] = FLOAT3D(fX1, -fY0, 0);

  // Recalculate text size
  _vTextSize(1) = Max(_vTextSize(1), fX1);
  _vTextSize(2) = Max(_vTextSize(2), fY1);

  // Advance position to the next character
  _vCharPos(1) += _fAdvancer;
};

// Render one character as a particle
static void RenderCharacter(INDEX iChar, const FLOAT3D &vRenderPos, const FLOATmatrix3D &mRenderRot, const SText3D &t3d) {
  const SCharEffects &cfx = (*_paEffects)[iChar];

  // Go to the next line
  if (cfx.ubChar == '\n') return;

  // Retrieve quad positions
  FLOAT3D vPos0 = _avQuadPos[0][iChar];
  FLOAT3D vPos1 = _avQuadPos[1][iChar];
  FLOAT3D vPos2 = _avQuadPos[2][iChar];
  FLOAT3D vPos3 = _avQuadPos[3][iChar];

  // Prepare UV coordinates for the texture
  const CFontCharData &fcd = t3d.pfdFont->fd_fcdFontCharData[cfx.ubChar];
  const FLOAT fCharX = fcd.fcd_pixXOffset;
  const FLOAT fCharY = fcd.fcd_pixYOffset;

  // -1 pixel from the bottom
  FLOATaabbox2D boxUV(
    FLOAT2D(fCharX,               fCharY),
    FLOAT2D(fCharX + _fCellWidth, fCharY + _fCellHeight - 1)
  );

  boxUV.StretchByVector(FLOAT2D(_fCorrectionU, _fCorrectionV));

  // Adjust alpha for flashing
  COLOR colRender = (cfx.colBlend & 0xFFFFFF00);
  UBYTE ubAlpha   = (cfx.colBlend & 0x000000FF);

  if (cfx.iFlash > 0) {
    colRender |= UBYTE(ubAlpha * (sin(cfx.iFlash * _tmText3D) * 0.5f + 0.5f));
  } else {
    colRender |= UBYTE(ubAlpha);
  }

  // Italic 20% slant
  if (cfx.bItalic) {
    const FLOAT fCharHeight = (vPos0(2) - vPos1(2));
    const FLOAT fAdjustX = t3d.fAspect * fCharHeight * 0.2f;

    vPos0(1) += fAdjustX;
    vPos3(1) += fAdjustX;
  }

  // Render character
  SetTexturePartDirectUV(boxUV);
  FLOAT3D v0 = vRenderPos + vPos0 * mRenderRot;
  FLOAT3D v1 = vRenderPos + vPos1 * mRenderRot;
  FLOAT3D v2 = vRenderPos + vPos2 * mRenderRot;
  FLOAT3D v3 = vRenderPos + vPos3 * mRenderRot;
  Particle_RenderQuad3D(v0, v1, v2, v3, colRender);

  // Render bold character
  if (cfx.bBold) {
    // Shift by 10%
    const FLOAT fBoldShift = t3d.fAspect * 0.1f;
    vPos0(1) += fBoldShift;
    vPos1(1) += fBoldShift;
    vPos2(1) += fBoldShift;
    vPos3(1) += fBoldShift;

    SetTexturePartDirectUV(boxUV);
    v0 = vRenderPos + vPos0 * mRenderRot;
    v1 = vRenderPos + vPos1 * mRenderRot;
    v2 = vRenderPos + vPos2 * mRenderRot;
    v3 = vRenderPos + vPos3 * mRenderRot;
    Particle_RenderQuad3D(v0, v1, v2, v3, colRender);
  }
};

inline void TextRenderLoop(const SText3D &t3d, const CPlacement3D &plPos, const CText3DEffects &aEffects,
  INDEX iAnchorX, INDEX iAnchorY, ParticleBlendType eBlendMode)
{
  // Position and rotation
  FLOAT3D vRenderPos = plPos.pl_PositionVector;

  FLOATmatrix3D mRot;
  MakeRotationMatrixFast(mRot, plPos.pl_OrientationAngle);

  // Start rendering
  Particle_PrepareTexture(t3d.ptoFont, eBlendMode);

  INDEX i;
  const INDEX ct = aEffects.Count();

  _paEffects = &aEffects;

  for (INDEX iQuad = 0; iQuad < 4; iQuad++) {
    _avQuadPos[iQuad].Clear();
    _avQuadPos[iQuad].New(ct);
  }

  // Determine text dimensions first
  for (i = 0; i < ct; i++) {
    DetermineCharPositions(i, t3d);
  }

  // Shift render position according to the anchors
  FLOAT3D vShift(0, 0, 0);

  // X center/right
  if (iAnchorX == 0) vShift(1) = -_vTextSize(1) * 0.5f;
  else
  if (iAnchorX == 1) vShift(1) = -_vTextSize(1);

  // Y center/bottom
  if (iAnchorY == 0) vShift(2) = _vTextSize(2) * 0.5f;
  else
  if (iAnchorY == 1) vShift(2) = _vTextSize(2);

  if (iAnchorX != -1 || iAnchorY != -1) {
    vRenderPos += vShift * mRot;
  }

  // Then render the characters
  for (i = 0; i < ct; i++) {
    RenderCharacter(i, vRenderPos, mRot, t3d);
  }

  // Finish rendering
  Particle_Flush();
};

// Display 3D text in the world from a pre-determined array of characters with effects
void Particles_Text3D(SText3D t3d, const CPlacement3D &plPos, const CText3DEffects &aEffects,
  INDEX iAnchorX, INDEX iAnchorY, ParticleBlendType eBlendMode)
{
  // Text would be invisible
  if (!SetupText3D(plPos.pl_PositionVector, t3d)) return;

  TextRenderLoop(t3d, plPos, aEffects, iAnchorX, iAnchorY, eBlendMode);
};

// Display 3D text in the world from a regular string
void Particles_Text3D(SText3D t3d, const CPlacement3D &plPos, const CTString &strText, INDEX iTagMode,
  INDEX iAnchorX, INDEX iAnchorY, ParticleBlendType eBlendMode)
{
  // Text would be invisible
  if (!SetupText3D(plPos.pl_PositionVector, t3d)) return;

  CText3DEffects aEffects;
  ParseStringWithTags(strText, iTagMode, 0xFFFFFFFF, aEffects);

  TextRenderLoop(t3d, plPos, aEffects, iAnchorX, iAnchorY, eBlendMode);
};
