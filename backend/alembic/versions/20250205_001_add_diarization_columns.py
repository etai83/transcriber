"""Add speaker diarization columns

Revision ID: 001
Revises: 
Create Date: 2025-02-05

Adds:
- num_speakers column to conversations table
- transcript_segments column to transcriptions table
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add num_speakers column to conversations table
    op.add_column('conversations', sa.Column('num_speakers', sa.Integer(), nullable=True))
    
    # Set default value for existing rows
    op.execute("UPDATE conversations SET num_speakers = 2 WHERE num_speakers IS NULL")
    
    # Add transcript_segments column to transcriptions table
    op.add_column('transcriptions', sa.Column('transcript_segments', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove transcript_segments column from transcriptions table
    op.drop_column('transcriptions', 'transcript_segments')
    
    # Remove num_speakers column from conversations table
    op.drop_column('conversations', 'num_speakers')
