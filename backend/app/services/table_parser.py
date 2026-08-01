"""
Table Extraction Parser Service.

Extracts structured tables from PDF documents using Camelot (`camelot-py`),
with an automatic fallback to `pdfplumber` table extraction if Camelot encounters
system dependency issues (e.g. missing Ghostscript) or processing errors.
"""

from pathlib import Path
from typing import List, Union
import pdfplumber

from app.core.logging import logger
from app.schemas.upload import ExtractedTable


class TableParser:
    """
    Modular Table Parser service extracting tables from PDFs without combining them with standard page text.
    """

    def parse_file(self, file_path: Union[str, Path]) -> List[ExtractedTable]:
        """
        Extracts all tables found within a PDF file located on disk.

        Args:
            file_path: Absolute or relative path to PDF file.

        Returns:
            List[ExtractedTable]: List of extracted table data objects with page numbers and cell matrices.
        """
        target_path = Path(file_path).resolve()
        logger.info(f"Extracting tables from file: '{target_path}'")

        # 1. Attempt Primary Table Extraction with Camelot
        tables = self._extract_camelot(target_path)

        # 2. If Camelot returns no tables or fails, execute pdfplumber fallback
        if not tables:
            logger.info(
                "Camelot extracted 0 tables. Attempting fallback table extraction via pdfplumber."
            )
            tables = self._extract_pdfplumber(target_path)

        logger.info(f"Total tables extracted from '{target_path.name}': {len(tables)}")
        return tables

    def _extract_camelot(self, file_path: Path) -> List[ExtractedTable]:
        """
        Primary table extraction using Camelot (lattice & stream flavors).

        Args:
            file_path: Path to PDF.

        Returns:
            List[ExtractedTable]: List of extracted tables.
        """
        extracted_tables: List[ExtractedTable] = []
        try:
            import camelot

            # Try lattice flavor first (for bordered tables)
            camelot_tables = camelot.read_pdf(
                str(file_path), pages="all", flavor="lattice"
            )
            
            # If lattice flavor yields no tables, attempt stream flavor (for borderless tables)
            if len(camelot_tables) == 0:
                camelot_tables = camelot.read_pdf(
                    str(file_path), pages="all", flavor="stream"
                )

            for table in camelot_tables:
                df = table.df
                cell_matrix = df.values.tolist()
                rows = len(cell_matrix)
                cols = len(cell_matrix[0]) if rows > 0 else 0
                
                extracted_tables.append(
                    ExtractedTable(
                        page=int(table.page),
                        table=cell_matrix,
                        row_count=rows,
                        col_count=cols,
                    )
                )
            logger.info(
                f"Camelot table parser successfully extracted {len(extracted_tables)} tables."
            )
        except Exception as err:
            logger.warning(
                f"Camelot table extraction encountered error or missing dependency: {err}"
            )
        return extracted_tables

    def _extract_pdfplumber(self, file_path: Path) -> List[ExtractedTable]:
        """
        Fallback table extraction using pdfplumber page table structures.

        Args:
            file_path: Path to PDF.

        Returns:
            List[ExtractedTable]: Extracted tables.
        """
        extracted_tables: List[ExtractedTable] = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for idx, page in enumerate(pdf.pages):
                    raw_tables = page.extract_tables() or []
                    for raw_table in raw_tables:
                        # Clean cell values (replace None with empty string)
                        clean_matrix = [
                            [cell if cell is not None else "" for cell in row]
                            for row in raw_table
                        ]
                        rows = len(clean_matrix)
                        cols = len(clean_matrix[0]) if rows > 0 else 0
                        
                        if rows > 0 and cols > 0:
                            extracted_tables.append(
                                ExtractedTable(
                                    page=idx + 1,
                                    table=clean_matrix,
                                    row_count=rows,
                                    col_count=cols,
                                )
                            )
            logger.info(
                f"pdfplumber table parser successfully extracted {len(extracted_tables)} tables."
            )
        except Exception as err:
            logger.error(f"pdfplumber table extraction failed: {err}")
        return extracted_tables
