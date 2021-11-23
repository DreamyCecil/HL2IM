#include "Formatting.h"

// Resize raw string
char *JSON_ResizeString(void *pMem, int ctSize) {
  char *pNew = new char[ctSize];

  memcpy(pNew, pMem, ctSize);
  delete[] pMem;

  return pNew;
};

// Format a config string
string JSON_ConfigPrintF(const char *strFormat, ...) {
  va_list arg;
  va_start(arg, strFormat);

  return JSON_VPrintF(strFormat, arg);
};

// Format some string using a list of arguments
string JSON_VPrintF(const char *strFormat, va_list arg) {
  static int _ctBufferSize = 0;
  static char *_pchBuffer = NULL;

  // allocate if buffer wasn't allocated yet
  if (_ctBufferSize == 0) {
    _ctBufferSize = 256;
    _pchBuffer = new char[_ctBufferSize];
  }

  // repeat
  int iLen;
  while (true) {
    // print to the buffer
    iLen = _vsnprintf(_pchBuffer, _ctBufferSize, strFormat, arg);

    // stop if printed ok
    if (iLen != -1) {
      break;
    }

    // increase the buffer size
    _ctBufferSize += 256;
    _pchBuffer = JSON_ResizeString(_pchBuffer, _ctBufferSize);
  }

  string strPrint = _pchBuffer;
  return strPrint;
};

// Config text tabs
string JSON_ConfigTabs(int iLevel) {
  string str = "";
  
  if (iLevel > 0) {
    for (int i = 0; i < iLevel; i++) {
      str = JSON_ConfigPrintF("%s  ", str.c_str());
    }
  }
  
  return str;
};