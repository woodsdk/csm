"""
Email Template — Standard HTML email wrapper for all outgoing emails.

Provides a clean, professional email design with People's Clinic branding.
Used by helpdesk replies, marketing emails, and campaign sends.
"""


def wrap_email(body_html: str, preheader: str = "") -> str:
    """Wrap email body content in the standard People's Clinic email template.

    Args:
        body_html: The inner HTML content (paragraphs, text, etc.)
        preheader: Optional preview text shown in email clients

    Returns:
        Complete HTML email string with branding.
    """
    return f"""<!DOCTYPE html>
<html lang="da" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>People's Clinic</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset */
    body, table, td, a {{ -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }}
    table, td {{ mso-table-lspace: 0pt; mso-table-rspace: 0pt; }}
    img {{ -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }}
    body {{ margin: 0; padding: 0; width: 100% !important; height: 100% !important; }}

    /* Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    /* Main styles */
    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f0f3fa;
      color: #26304f;
      line-height: 1.6;
    }}

    .email-wrapper {{
      width: 100%;
      background-color: #f0f3fa;
      padding: 32px 16px;
    }}

    .email-container {{
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(38, 48, 79, 0.08);
    }}

    /* Header */
    .email-header {{
      padding: 28px 40px 20px;
      text-align: left;
      border-bottom: 1px solid #e8ecf4;
    }}

    .email-logo {{
      height: 28px;
      width: auto;
    }}

    /* Body */
    .email-body {{
      padding: 32px 40px;
      font-size: 15px;
      line-height: 1.7;
      color: #26304f;
    }}

    .email-body p {{
      margin: 0 0 16px;
    }}

    .email-body p:last-child {{
      margin-bottom: 0;
    }}

    .email-body strong {{
      font-weight: 600;
      color: #1a2340;
    }}

    .email-body a {{
      color: #4f5fa3;
      text-decoration: underline;
    }}

    /* Footer */
    .email-footer {{
      padding: 24px 40px;
      background-color: #f8f9fc;
      border-top: 1px solid #e8ecf4;
      text-align: center;
      font-size: 12px;
      color: #8891ab;
      line-height: 1.5;
    }}

    .email-footer a {{
      color: #4f5fa3;
      text-decoration: none;
    }}

    .footer-brand {{
      font-weight: 600;
      color: #26304f;
      font-size: 13px;
      margin-bottom: 6px;
    }}

    /* Preheader */
    .preheader {{
      display: none !important;
      visibility: hidden;
      mso-hide: all;
      font-size: 1px;
      color: #f0f3fa;
      line-height: 1px;
      max-height: 0;
      max-width: 0;
      opacity: 0;
      overflow: hidden;
    }}

    /* Responsive */
    @media only screen and (max-width: 620px) {{
      .email-wrapper {{ padding: 16px 8px; }}
      .email-header {{ padding: 20px 24px 16px; }}
      .email-body {{ padding: 24px; font-size: 14px; }}
      .email-footer {{ padding: 20px 24px; }}
    }}
  </style>
</head>
<body>
  {f'<div class="preheader">{preheader}</div>' if preheader else ''}
  <div class="email-wrapper">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <div class="email-container">
            <!-- Header -->
            <div class="email-header">
              <img src="https://csm-production.up.railway.app/assets/peoples-clinic.svg" alt="People's Clinic" class="email-logo" height="28">
            </div>

            <!-- Body -->
            <div class="email-body">
              {body_html}
            </div>

            <!-- Footer -->
            <div class="email-footer">
              <div class="footer-brand">People's Clinic</div>
              <div>Den digitale sundhedsplatform for klinikker</div>
              <div style="margin-top: 8px;">
                <a href="https://peoplesclinic.dk">peoplesclinic.dk</a>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>"""
