#pragma once

#include "../ConfigElement.h"
#include "../Containers/ConfigArray.h"
#include "../Containers/ConfigBlock.h"

// Value Types
enum EConfigValueType {
  CVT_UNKNOWN = -1,
  CVT_INDEX,  // index value
  CVT_FLOAT,  // float value
  CVT_STRING, // string value
  CVT_ARRAY,  // array of values
  CVT_BLOCK,  // block of values
};

// Value type names
static const char *_astrConfigValueTypes[] = {
  "CVT_UNKNOWN",
  "CVT_INDEX",
  "CVT_FLOAT",
  "CVT_STRING",
  "CVT_ARRAY",
  "CVT_BLOCK",
};

class DJSON_API CConfigValue : CConfigElement {
  public:
    EConfigValueType cv_eType;
    
    union {
      int cv_iValue; // index value
      float cv_fValue; // float value
      char cv_strValue[256]; // string value
      CConfigArray *cv_caValue; // array of values
      CConfigBlock *cv_cbValue; // block of values
    };
    
    // Constructors
    CConfigValue(void);
    CConfigValue(const int &iValue);
    CConfigValue(const float &fValue);
    CConfigValue(const string &strValue);
    CConfigValue(CConfigArray *caValue);
    CConfigValue(CConfigBlock *cbValue);
    
    // Set new value
    void SetValue(const int &iValue);
    void SetValue(const float &fValue);
    void SetValue(const string &strValue);
    void SetValue(CConfigArray *caValue);
    void SetValue(CConfigBlock *cbValue);
    
    // Destructor
    ~CConfigValue(void);
    void Clear(void);
    
    // Print the value
    void PrintValue(string &strValue, const int &iLevel, bool bHasKey);
};
