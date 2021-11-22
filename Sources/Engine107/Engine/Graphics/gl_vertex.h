#pragma once

//#include <Engine/Graphics/Color.h>


#define GLNormal GLVertex
struct GLVertex {
  union { 
    struct { FLOAT  x, y, z; };
    struct { FLOAT nx,ny,nz; };
  };
  void Clear(void) {};
};


struct GLTexCoord {
  FLOAT s,t;
  void Clear(void) {};
};


struct GLTexCoord4 {
  FLOAT s,t,r,q;
  void Clear(void) {};
};


struct GLColor {
  union {
    struct { UBYTE r,g,b,a; };
    struct { ULONG abgr;    };  // reverse order! - use Bswap(color)
  };
  void Clear(void) {};
  GLColor() {};
  GLColor( COLOR col) {
    _asm mov   ecx,dword ptr [this]
    _asm mov   eax,dword ptr [col]
    _asm bswap eax
    _asm mov   dword ptr [ecx],eax
  };
  __forceinline void Set( COLOR col) {
    _asm mov   ecx,dword ptr [this]
    _asm mov   eax,dword ptr [col]
    _asm bswap eax
    _asm mov   dword ptr [ecx],eax
  };
  void MultiplyRGBA( const GLColor &col1, const GLColor &col2) {
    r = (ULONG(col1.r)*col2.r)>>8;
    g = (ULONG(col1.g)*col2.g)>>8;
    b = (ULONG(col1.b)*col2.b)>>8;
    a = (ULONG(col1.a)*col2.a)>>8;
  }
  void MultiplyRGB( const GLColor &col1, const GLColor &col2) {
    r = (ULONG(col1.r)*col2.r)>>8;
    g = (ULONG(col1.g)*col2.g)>>8;
    b = (ULONG(col1.b)*col2.b)>>8;
  }
  void MultiplyRGBCopyA1( const GLColor &col1, const GLColor &col2) {
    r = (ULONG(col1.r)*col2.r)>>8;
    g = (ULONG(col1.g)*col2.g)>>8;
    b = (ULONG(col1.b)*col2.b)>>8;
    a = col1.a;
  }
  void AttenuateRGB( ULONG ulA) {
    r = (ULONG(r)*ulA)>>8;
    g = (ULONG(g)*ulA)>>8;
    b = (ULONG(b)*ulA)>>8;
  }
  void AttenuateA( ULONG ulA) {
    a = (ULONG(a)*ulA)>>8;
  }
};


struct GLVertex4 {
  FLOAT x,y,z;
  union {
    struct { struct GLColor col; };
    struct { SLONG shade; };
  };
  void Clear(void) {};
};
