"""
Image Preprocessing Service for OCR Optimization.

Provides an OpenCV-based pipeline for enhancing image quality prior to OCR text extraction:
- Grayscale conversion
- Image resizing for low-resolution input
- CLAHE Contrast enhancement
- Denoising & sharpening
- Automatic deskewing / angle correction
- Adaptive thresholding
"""

import io
from typing import Union
import cv2
import numpy as np
from PIL import Image

from app.core.logging import logger


class ImagePreprocessor:
    """
    OpenCV Image Preprocessor providing standalone image enhancement methods
    and an integrated OCR optimization pipeline.
    """

    def preprocess_image(
        self, image_input: Union[np.ndarray, bytes, Image.Image]
    ) -> np.ndarray:
        """
        Executes full preprocessing pipeline on input image.

        Args:
            image_input: Input image as numpy array, byte stream, or PIL Image.

        Returns:
            np.ndarray: Preprocessed grayscale OpenCV image ready for OCR.
        """
        # 1. Convert input to OpenCV BGR numpy array
        cv_img = self.to_opencv_image(image_input)

        # 2. Resize small images if dimensions are below minimum threshold
        resized_img = self.resize_if_small(cv_img, min_dimension=800)

        # 3. Grayscale conversion
        gray_img = self.convert_to_grayscale(resized_img)

        # 4. Contrast enhancement via CLAHE
        enhanced_img = self.enhance_contrast(gray_img)

        # 5. Denoising
        denoised_img = self.denoise(enhanced_img)

        # 6. Sharpening
        sharpened_img = self.sharpen(denoised_img)

        # 7. Deskewing / Skew Angle Correction
        deskewed_img = self.deskew(sharpened_img)

        # 8. Adaptive Thresholding
        final_img = self.adaptive_threshold(deskewed_img)

        logger.debug(
            f"Image preprocessing pipeline complete. Output shape: {final_img.shape}"
        )
        return final_img

    @staticmethod
    def to_opencv_image(image_input: Union[np.ndarray, bytes, Image.Image]) -> np.ndarray:
        """
        Converts any image input format (bytes, PIL, numpy) into a standard OpenCV BGR numpy array.
        """
        if isinstance(image_input, np.ndarray):
            return image_input.copy()
        elif isinstance(image_input, bytes):
            nparr = np.frombuffer(image_input, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Failed to decode image bytes into OpenCV format.")
            return img
        elif isinstance(image_input, Image.Image):
            rgb_arr = np.array(image_input.convert("RGB"))
            return cv2.cvtColor(rgb_arr, cv2.COLOR_RGB2BGR)
        else:
            raise TypeError(f"Unsupported image input type: {type(image_input)}")

    @staticmethod
    def convert_to_grayscale(img: np.ndarray) -> np.ndarray:
        """Converts image to 8-bit grayscale if not already grayscale."""
        if len(img.shape) == 3 and img.shape[2] == 3:
            return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        return img

    @staticmethod
    def resize_if_small(img: np.ndarray, min_dimension: int = 800) -> np.ndarray:
        """Resizes image up if height or width is smaller than min_dimension."""
        height, width = img.shape[:2]
        if height < min_dimension or width < min_dimension:
            scale = max(min_dimension / height, min_dimension / width)
            new_w, new_h = int(width * scale), int(height * scale)
            return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
        return img

    @staticmethod
    def enhance_contrast(gray_img: np.ndarray) -> np.ndarray:
        """Applies Contrast Limited Adaptive Histogram Equalization (CLAHE)."""
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(gray_img)

    @staticmethod
    def denoise(gray_img: np.ndarray) -> np.ndarray:
        """Applies fast non-local means denoising."""
        return cv2.fastNlMeansDenoising(gray_img, h=10, templateWindowSize=7, searchWindowSize=21)

    @staticmethod
    def sharpen(gray_img: np.ndarray) -> np.ndarray:
        """Applies a sharpening filter kernel to enhance character edges."""
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
        return cv2.filter2D(gray_img, -1, kernel)

    @staticmethod
    def deskew(gray_img: np.ndarray) -> np.ndarray:
        """Detects image skew angle and rotates the image to align text horizontally."""
        try:
            # Invert image to find text contours
            inverted = cv2.bitwise_not(gray_img)
            thresh = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

            coords = np.column_stack(np.where(thresh > 0))
            if len(coords) < 10:
                return gray_img

            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle

            # Ignore minimal skew angles
            if abs(angle) < 0.5 or abs(angle) > 45.0:
                return gray_img

            height, width = gray_img.shape[:2]
            center = (width // 2, height // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            deskewed = cv2.warpAffine(
                gray_img, M, (width, height), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
            )
            return deskewed
        except Exception as err:
            logger.debug(f"Deskewing skipped due to error: {err}")
            return gray_img

    @staticmethod
    def adaptive_threshold(gray_img: np.ndarray) -> np.ndarray:
        """Applies adaptive Gaussian thresholding to produce crisp binary text."""
        return cv2.adaptiveThreshold(
            gray_img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
