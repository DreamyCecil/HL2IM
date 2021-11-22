#ifndef SE_INCL_FILENAME_H
#define SE_INCL_FILENAME_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <Engine/Base/CTString.h>

/*
 * Special kind of string, dedicated to storing filenames.
 */
class ENGINE_API CTFileName : public CTString {
public:
  class CSerial *fnm_pserPreloaded;     // pointer to already loaded object if available
private:
  /* Constructor from character string. */
  inline CTFileName(const char *pString) : CTString(pString), fnm_pserPreloaded(NULL) {};
public:
  /* Default constructor. */
  inline CTFileName(void) : fnm_pserPreloaded(NULL) {};
  /* Copy constructor. */
  inline CTFileName(const CTString &strOriginal) : CTString(strOriginal), fnm_pserPreloaded(NULL) {};
  /* Constructor from character string for insertion in exe-file. */
  inline CTFileName(const char *pString, int i) : CTString(pString+i), fnm_pserPreloaded(NULL) {};

  /* Assignment. */
  CTFileName &operator=(const char *strCharString);
  inline void operator=(const CTString &strOther) {
    CTString::operator=(strOther);
    fnm_pserPreloaded = NULL;
  };

  /* Get directory part of a filename. */
  CTFileName FileDir(void) const;
  /* Get name part of a filename. */
  CTFileName FileName(void) const;
  /* Get extension part of a filename. */
  CTFileName FileExt(void) const;
  /* Get path and file name without extension. */
  CTFileName NoExt(void) const;
  /* Remove application path from a file name. */
  void RemoveApplicationPath_t(void); // throw char *

  // filename is its own name (used for storing in nametable)
  inline const CTFileName &GetName(void) { return *this; };

  void ReadFromText_t(CTStream &strmStream, const CTString &strKeyword=""); // throw char *

  /* Read from stream. */
  ENGINE_API friend CTStream &operator>>(CTStream &strmStream, CTFileName &fnmFileName);
  /* Write to stream. */
  ENGINE_API friend CTStream &operator<<(CTStream &strmStream, const CTFileName &fnmFileName);
};

// macro for defining a literal filename in code (EFNM = exe-filename)
#define CTFILENAME(string) CTFileName("EFNM" string, 4)
#define DECLARE_CTFILENAME(name, string) CTFileName name("EFNM" string, 4)



#endif  /* include-once check. */

