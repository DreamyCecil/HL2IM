#ifndef SE_INCL_FONT_H
#define SE_INCL_FONT_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <Engine/Base/FileName.h>
#include <Engine/Base/Serial.h>


// some default fonts
ENGINE_API extern CFontData *_pfdDisplayFont;
ENGINE_API extern CFontData *_pfdConsoleFont;


/*
 * font letter description
 */
class ENGINE_API CFontCharData {
public:
  PIX fcd_pixXOffset, fcd_pixYOffset; // offset of letter inside tex file (in pixels)
  PIX fcd_pixStart, fcd_pixEnd;       // position and size adjustment for current letter
  // constructor
  CFontCharData(void);
  // simple stream functions
  void Read_t(  CTStream *inFile);
  void Write_t( CTStream *outFile);
};


/*
 * font description
 */
class ENGINE_API CFontData : public CSerial {
// implementation
public:
  PIX  fd_pixCharSpacing, fd_pixLineSpacing;  // intra character and intra line spacing
  PIX  fd_pixCharWidth, fd_pixCharHeight;     // maximum character width and height
  BOOL fd_bFixedWidth;   // treated as of fixed width

  CTFileName fd_fnTexture;
  class CFontCharData fd_fcdFontCharData[256];
  class CTextureData *fd_ptdTextureData;

// interface
public:
  CFontData();
  ~CFontData();
  inline PIX  GetWidth(void)       const { return fd_pixCharWidth;   };
  inline PIX  GetHeight(void)      const { return fd_pixCharHeight;  };
  inline PIX  GetCharSpacing(void) const { return fd_pixCharSpacing; };
  inline PIX  GetLineSpacing(void) const { return fd_pixLineSpacing; };
  inline BOOL IsFixedWidth(void)   const { return fd_bFixedWidth;    };
  inline void SetCharSpacing( PIX pixSpacing) { fd_pixCharSpacing = pixSpacing; };
  inline void SetLineSpacing( PIX pixSpacing) { fd_pixLineSpacing = pixSpacing; };
  inline void SetFixedWidth(void)    { fd_bFixedWidth = TRUE; };
  inline void SetVariableWidth(void) { fd_bFixedWidth = FALSE; };
  inline void SetSpaceWidth( FLOAT fWidthRatio) { // relative to char cell width (1/2 is default)
              fd_fcdFontCharData[' '].fcd_pixEnd = (PIX)(fd_pixCharWidth*fWidthRatio); }

  void Read_t(  CTStream *inFile); // throw char *
  void Write_t( CTStream *outFile); // throw char *
  void Make_t( const CTFileName &fnTexture, PIX pixCharWidth, PIX pixCharHeight,
               CTFileName &fnOrderFile, BOOL bUseAlpha);
  void Clear();
};


#endif  /* include-once check. */

