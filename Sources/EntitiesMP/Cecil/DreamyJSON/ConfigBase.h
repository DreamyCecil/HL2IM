#pragma once

#include <string>
#include <fstream>
#include <stdarg.h>
using namespace std;

// For importing
#ifndef DJSON_API
#define DJSON_API _declspec(dllexport)
#endif

// Dependencies
#include "../DreamyStructures/DataStructures.h"

#include "Base/Formatting.h"
#include "Base/Compatibility.h"
