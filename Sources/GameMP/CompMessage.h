#ifndef SE_INCL_COMPMESSAGE_H
#define SE_INCL_COMPMESSAGE_H
#ifdef PRAGMA_ONCE
  #pragma once
#endif

class CCompMessage {
public:
  CTFileName cm_fnmFileName;        // message identificator
  CCompMessageID *cm_pcmiOriginal;  // identifier in player's array

  BOOL cm_bLoaded;            // set if message is loaded
  CTString cm_strSubject;     // message subject
  enum ImageType {
    IT_NONE,
    IT_MODEL,
    IT_PICTURE,
    IT_STATISTICS,
  } cm_itImage;               // accompanying image if any
  CTString cm_strModel;       // name of model if model
  CTFileName cm_fnmPicture;   // filename of picture if picture
  CTString cm_strText;        // original message text

  BOOL cm_bRead;

  INDEX cm_ctFormattedWidth;    // chars per row in formatted text
  INDEX cm_ctFormattedLines;    // number of lines in formatted text
  CTString cm_strFormattedText; // text formatted for given line width

  // load the message from file
  void Load_t(void);  // throw char *
  // format message for given line width
  void Format(INDEX ctCharsPerLine);

public:
  CCompMessage(void);
  void Clear(void);
  // constructs message from ID
  void SetMessage(CCompMessageID *pcmi);
  // prepare message for using (load, format, etc.)
  void PrepareMessage(INDEX ctCharsPerLine);
  // free memory used by message, but keep message filename
  void UnprepareMessage(void);
  // mark message as read
  void MarkRead(void);
  // get one formatted line
  CTString GetLine(INDEX iLine);
};


#endif  /* include-once check. */

