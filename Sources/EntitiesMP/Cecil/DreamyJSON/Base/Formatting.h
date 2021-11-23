#pragma once

#include "../ConfigBase.h"

// Format a config string
DJSON_API string JSON_ConfigPrintF(const char *strFormat, ...);
// Format some string using a list of arguments
DJSON_API string JSON_VPrintF(const char *strFormat, va_list arg);

// Config text tabs
DJSON_API string JSON_ConfigTabs(int iLevel);
