# Admin Guide

## Adding YouTube Channels

Channels can only be added by admins using the backend script. The frontend no longer has the ability to add channels.

### Method 1: Command Line Arguments

Add channels directly via command line:

```bash
cd backend
bun run src/scripts/add-channels.ts "https://www.youtube.com/@Channel1" "https://www.youtube.com/@Channel2"
```

### Method 2: From a File

Create a text file with channel URLs (one per line):

```bash
# Create channels.txt
cat > channels.txt << EOF
https://www.youtube.com/@GrahamStephan
https://www.youtube.com/@MeetKevin
https://www.youtube.com/@AndreiJikh
EOF

# Add all channels from file
bun run src/scripts/add-channels.ts --file channels.txt
```

### Supported URL Formats

- `https://www.youtube.com/@ChannelHandle`
- `https://www.youtube.com/channel/UCxxxxx`
- `https://youtube.com/@ChannelHandle`
- `https://youtube.com/channel/UCxxxxx`

### Example Output

```
📺 Adding 3 channel(s)...

[1/3] Processing: https://www.youtube.com/@GrahamStephan
  ✅ Added: Graham Stephan (UCxxxxx)
[2/3] Processing: https://www.youtube.com/@MeetKevin
  ✅ Added: Meet Kevin (UCyyyyy)
[3/3] Processing: https://www.youtube.com/@AndreiJikh
  ⏭️  Already exists: Andrei Jikh

📊 Summary:
  ✅ Successfully added: 2
  ⏭️  Skipped (already exists): 1
  ❌ Errors: 0
```

### Notes

- The script automatically skips channels that already exist
- Each channel addition has a 500ms delay to avoid rate limiting
- Errors are reported at the end with details
- The script connects to your database using the same configuration as the API

