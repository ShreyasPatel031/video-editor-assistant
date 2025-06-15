# 🎯 Enhanced GoPro Video Search System

## 🚀 Quick Start

1. **Install Dependencies:**
   ```bash
   pip install google-generativeai scikit-learn numpy
   ```

2. **Set API Keys:**
   Edit `smart_video_search.py` lines 13-16 with your Gemini API keys

3. **Run Search:**
   ```bash
   python smart_video_search.py "your search query"
   ```

## 📋 Example Queries

- `"top 2 video of me cycling in desert"`
- `"top 5 video of my driving at race track and in snow"`
- `"top 4 video of driving in snow"`
- `"top 3 video of driving mercedes at track"`

## 📁 Files

- `smart_video_search.py` - Main search engine
- `COMPREHENSIVE_DOCUMENTATION.txt` - Complete documentation
- `Embeddings_AI_Analyzed/` - 98 video chunks from 9 GoPro videos

## 🎯 Features

✅ Stop Word Filtering  
✅ Comprehensive Synonym Mapping  
✅ Multiple Condition Detection  
✅ Dual API Key System  
✅ Parallel Processing  
✅ AI Summary Generation  

## 📊 Dataset

- **98 chunks** from **9 GoPro videos**
- **103 activities**, **47 scenes**, **120+ objects**
- **Intelligent filtering**: 98 → 15-25 relevant chunks per query 