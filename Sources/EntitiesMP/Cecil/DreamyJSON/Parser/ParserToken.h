#pragma once

#include "../ConfigBase.h"

// Parser Token Type
enum EParserToken {
  EPT_UNKNOWN = -1,
  
  EPT_OPEN_C,  // opening curly bracket
  EPT_CLOSE_C, // closing curly bracket
  EPT_OPEN_S,  // opening square bracket
  EPT_CLOSE_S, // closing square bracket
  
  EPT_COLON, // colon
  EPT_COMMA, // comma
  
  EPT_INDEX,  // index value
  EPT_FLOAT,  // float value
  EPT_STRING, // string value
  
  EPT_END, // end of file
};

// Parser Token Template
class DJSON_API CParserToken {
  public:
    int pt_eTokenType;
    int pt_iLine; // token place
    
    union {
      float pt_fValue; // float value
      char pt_strValue[256]; // string value
    };
    
    // Constructors
    CParserToken(void) :
      pt_eTokenType(EPT_UNKNOWN), pt_iLine(0), pt_fValue(0.0f) {};
    
    CParserToken(const int &iType, const int &iLine) :
      pt_eTokenType(iType), pt_iLine(iLine), pt_fValue(0.0f) {};
      
    CParserToken(const int &iType, const int &iLine, const float &f) :
      pt_eTokenType(iType), pt_iLine(iLine), pt_fValue(f) {};
      
    CParserToken(const int &iType, const int &iLine, const string &str) :
      pt_eTokenType(iType), pt_iLine(iLine)
    {
      strcpy(pt_strValue, str.c_str());
    };
};
