use objc2::rc::autoreleasepool;
use objc2_app_kit::{
    NSBitmapImageFileType, NSBitmapImageRep, NSPasteboard, NSPasteboardTypePNG,
    NSPasteboardTypeTIFF,
};
use objc2_foundation::{NSData, NSDictionary, NSString};

use super::read_image_png::NO_CLIPBOARD_IMAGE;

fn png_from_image_data(data: &NSData) -> Result<Vec<u8>, String> {
    let image_rep = NSBitmapImageRep::imageRepWithData(data)
        .ok_or_else(|| "Failed to decode clipboard image".to_string())?;
    let properties = NSDictionary::new();
    let png = unsafe {
        image_rep.representationUsingType_properties(NSBitmapImageFileType::PNG, &properties)
    }
    .ok_or_else(|| "Failed to encode clipboard image as PNG".to_string())?;
    let bytes = png.to_vec();
    if bytes.is_empty() {
        return Err("Failed to encode clipboard image as PNG".to_string());
    }
    Ok(bytes)
}

fn png_from_pasteboard_type(
    pasteboard: &NSPasteboard,
    pasteboard_type: &NSString,
) -> Option<Result<Vec<u8>, String>> {
    let data = pasteboard.dataForType(pasteboard_type)?;
    if data.is_empty() {
        return None;
    }
    Some(png_from_image_data(&data))
}

pub fn read_png_bytes() -> Result<Vec<u8>, String> {
    autoreleasepool(|_| {
        let pasteboard = NSPasteboard::generalPasteboard();

        if let Some(data) = pasteboard.dataForType(unsafe { NSPasteboardTypePNG }) {
            let bytes = data.to_vec();
            if !bytes.is_empty() {
                return Ok(bytes);
            }
        }

        let heic_type = NSString::from_str("public.heic");
        let jpeg_type = NSString::from_str("public.jpeg");
        let gif_type = NSString::from_str("public.gif");
        let webp_type = NSString::from_str("public.webp");
        let transcode_types: [&NSString; 5] = [
            unsafe { NSPasteboardTypeTIFF },
            &heic_type,
            &jpeg_type,
            &gif_type,
            &webp_type,
        ];

        let mut first_error: Option<String> = None;
        for pasteboard_type in transcode_types {
            match png_from_pasteboard_type(&pasteboard, pasteboard_type) {
                Some(Ok(bytes)) => return Ok(bytes),
                Some(Err(error)) => {
                    if first_error.is_none() {
                        first_error = Some(error);
                    }
                }
                None => {}
            }
        }

        Err(first_error.unwrap_or_else(|| NO_CLIPBOARD_IMAGE.to_string()))
    })
}
