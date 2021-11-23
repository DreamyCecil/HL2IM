#pragma once

#include "../ConfigElement.h"
#include "../Containers/ConfigArray.h"
#include "../Containers/ConfigBlock.h"
#include "ParserToken.h"

// Parse JSON config
DJSON_API bool ParseConfig(const char *strConfigFile, CConfigBlock &cbConfig);

// Parse config elements
DJSON_API int ParseArray(CConfigArray *caArray);
DJSON_API int ParseBlock(CConfigBlock *cbConfig);
DJSON_API int ParseKey(CConfigBlock *cbConfig);
DJSON_API int ParseValue(CConfigValue *cvValue);

// Add one token to the list
DJSON_API void AddToken(const EParserToken &eType, const int &iLine);
DJSON_API void AddToken(const EParserToken &eType, const int &iLine, const float &fValue);
DJSON_API void AddToken(const EParserToken &eType, const int &iLine, const string &strValue);
