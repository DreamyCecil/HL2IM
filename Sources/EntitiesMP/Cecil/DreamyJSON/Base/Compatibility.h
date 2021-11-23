#pragma once

#include "../ConfigBase.h"

// Throw formatted exception
DJSON_API void JSON_Throw(const char *strFormat, ...);
// Print out formatted string
DJSON_API void JSON_Print(const char *strFormat, ...);

// Load the config file
DJSON_API string JSON_LoadConfigFile(string strConfigFile);
