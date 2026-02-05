# Manual Model Download Instructions

Due to SSL certificate issues, you need to manually download the pyannote models.

## Step 1: Accept Model Licenses

You must accept the license agreements on HuggingFace (requires free account):

1. https://huggingface.co/pyannote/speaker-diarization-3.1 - Click "Agree and access repository"
2. https://huggingface.co/pyannote/segmentation-3.0 - Click "Agree and access repository"  
3. https://huggingface.co/pyannote/wespeaker-voxceleb-resnet34-LM - Click "Agree and access repository"

## Step 2: Download Models

Create the following directory structure and download files:

```
backend/models/pyannote/
├── speaker-diarization-3.1/
│   └── config.yaml
├── segmentation-3.0/
│   ├── config.yaml
│   └── pytorch_model.bin  (~5 MB)
└── wespeaker-voxceleb-resnet34-LM/
    ├── config.yaml
    └── pytorch_model.bin  (~26 MB)
```

### Download Links (right-click -> Save As):

**speaker-diarization-3.1:**
- https://huggingface.co/pyannote/speaker-diarization-3.1/resolve/main/config.yaml

**segmentation-3.0:**
- https://huggingface.co/pyannote/segmentation-3.0/resolve/main/config.yaml
- https://huggingface.co/pyannote/segmentation-3.0/resolve/main/pytorch_model.bin

**wespeaker-voxceleb-resnet34-LM:**
- https://huggingface.co/pyannote/wespeaker-voxceleb-resnet34-LM/resolve/main/config.yaml
- https://huggingface.co/pyannote/wespeaker-voxceleb-resnet34-LM/resolve/main/pytorch_model.bin

## Step 3: Verify Structure

After downloading, your directory should look like:

```
$ ls -la backend/models/pyannote/*/
speaker-diarization-3.1/:
  config.yaml

segmentation-3.0/:
  config.yaml
  pytorch_model.bin

wespeaker-voxceleb-resnet34-LM/:
  config.yaml
  pytorch_model.bin
```

## Step 4: Restart the Backend

After placing the files, restart the backend server. The diarizer will load from these local files.
