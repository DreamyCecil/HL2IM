#pragma once

#include "ConfigBase.h"

// JSON garbage collector (for debugging purposes)
//#define DREAMY_JSON_GC
  
// Config Element Base
class DJSON_API CConfigElement {
  protected:
    int ce_iGCIndex;
    
    enum EConfigElementType {
      CET_VALUE,
      CET_BLOCK,
      CET_ARRAY,
    } ce_eElementType;
    
    CConfigElement(const EConfigElementType eType) : ce_eElementType(eType) {};
};

#ifdef DREAMY_JSON_GC
  extern CCecilList<CConfigElement *> _aConfigGarbage;
#endif

// Predefine the elements
class CConfigArray;
class CConfigBlock;
class CConfigValue;
