"""Generate the demo narrator and exact provider word boundaries; no time-stretching."""
import asyncio, json, pathlib, subprocess
import edge_tts
out=pathlib.Path("demo-production-v2/output")
out.mkdir(parents=True,exist_ok=True)
plan=json.loads(pathlib.Path("demo-production-v2/voice-plan.json").read_text())
async def main():
    text="\n\n".join(p["text"] for p in plan)
    voice="en-US-AndrewMultilingualNeural"
    words=[]
    with (out/"narration-full.mp3").open("wb") as f:
        async for part in edge_tts.Communicate(text,voice,rate="-15%",boundary="WordBoundary",receive_timeout=90).stream():
            if part["type"]=="audio": f.write(part["data"])
            elif part["type"]=="WordBoundary":
                words.append(part)
                if len(words)%40==0: print(json.dumps({"words":len(words)}),flush=True)
    assert len(words)>200,"Narration did not complete"
    metadata={"voice":voice,"rate":"-15%","text":text,"words":words}
    (out/"narration-full.json").write_text(json.dumps(metadata,indent=2))
    print(json.dumps({"result":"ready","words":len(words),"last_word_seconds":(words[-1]["offset"]+words[-1]["duration"])/10000000}),flush=True)
asyncio.run(main())
