#include "Compatibility.h"

// Custom functions
extern void (*_pJSON_PrintFunction)(const char *) = NULL;
extern string (*_pJSON_LoadConfigFile)(string) = NULL;

// Throw formatted exception
void JSON_Throw(const char *strFormat, ...) {
  const int ctBufferSize = 256;
  char strBuffer[ctBufferSize+1];

  va_list arg;
  va_start(arg, strFormat);
  _vsnprintf(strBuffer, ctBufferSize, strFormat, arg);

  throw strBuffer;
};

// Print out formatted string
void JSON_Print(const char *strFormat, ...) {
  // no output function
  if (_pJSON_PrintFunction == NULL) {
    return;
  }

  va_list arg;
  va_start(arg, strFormat);

  string strOut = JSON_VPrintF(strFormat, arg);
  _pJSON_PrintFunction(strOut.c_str());
};

// Load the config file
string JSON_LoadConfigFile(string strConfigFile) {
  // custom loading function
  if (_pJSON_LoadConfigFile != NULL) {
    return _pJSON_LoadConfigFile(strConfigFile);
  }
    
  string strConfig = "";

  ifstream strm;
  strm.open(strConfigFile.c_str());

  if (!strm) {
    JSON_Throw("Cannot open config file '%s'", strConfigFile.c_str());
  }

  // read until the end
  while (!strm.eof()) {
    string strLine = "";
    getline(strm, strLine);

    // save each line into the config string
    strConfig += strLine+"\n";
  }
  strm.close();
  
  // return config
  return strConfig;
};