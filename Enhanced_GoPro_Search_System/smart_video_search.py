#!/usr/bin/env python3
"""
Smart Video Search System
Uses Gemini to extract keywords, then searches through embedding folders to find matching video chunks
"""

import json
import google.generativeai as genai
import os
import sys
from typing import List, Dict, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Configure Gemini API with dual keys for load balancing
GEMINI_KEYS = [
    "AIzaSyAKvr1pQOWZyZq8bCE5a1Bc1qBzDNo-5bw",
    "AIzaSyBOdHsZLbBR0SiZwWp9mCzpYL-CRACRHPM"
]

class SmartVideoSearch:
    """Complete video search system with Gemini keyword extraction and embedding search"""
    
    def __init__(self, embeddings_dir: str = "Embeddings_AI_Analyzed"):
        self.embeddings_dir = embeddings_dir
        self.current_key_index = 0
        self.models = []
        
        # Activity synonym mapping
        self.activity_synonyms = {
            # Cycling/Biking variations
            'cycling': ['mountain biking', 'biking', 'bike'],
            'cycle': ['mountain biking', 'biking', 'bike'],
            'bike': ['biking', 'mountain biking'],
            'bicycle': ['biking', 'mountain biking'],
            
            # Skiing variations
            'ski': ['skiing', 'sand skiing'],
            'skiing': ['skiing', 'sand skiing'],
            
            # Skateboarding variations
            'skate': ['skateboarding'],
            'skateboard': ['skateboarding'],
            
            # Surfing variations
            'surf': ['surfing'],
            'surfing': ['surfing'],
            
            # Diving variations
            'dive': ['scuba diving', 'diving', 'scuba_diving'],
            'diving': ['scuba diving', 'diving', 'scuba_diving'],
            'scuba': ['scuba diving', 'scuba_diving'],
            
            # Climbing variations
            'climb': ['climbing'],
            'climbing': ['climbing'],
            
            # Running variations
            'run': ['running', 'free running', 'freerunning', 'free-running'],
            'running': ['running', 'free running', 'freerunning', 'free-running'],
            'parkour': ['parkour', 'free running', 'freerunning', 'free-running'],
            
            # Jumping variations
            'jump': ['jumping'],
            'jumping': ['jumping'],
            
            # Driving/Racing variations
            'drive': ['driving', 'car racing'],
            'driving': ['driving', 'car racing'],
            'race': ['racing', 'car racing', 'motorcycle racing', 'motorcycle_racing'],
            'racing': ['racing', 'car racing', 'motorcycle racing', 'motorcycle_racing'],
            'motorbike': ['motorcycle racing', 'motorcycle_racing'],
            'motorcycle': ['motorcycle racing', 'motorcycle_racing'],
            
            # Water sports
            'kayak': ['kayaking'],
            'kayaking': ['kayaking'],
            'boat': ['boating'],
            'boating': ['boating'],
            'sail': ['sailing'],
            'sailing': ['sailing'],
            'swim': ['swimming'],
            'swimming': ['swimming'],
            'snorkel': ['snorkeling'],
            'snorkeling': ['snorkeling'],
            
            # Winter sports
            'snowboard': ['snowboarding'],
            'snowboarding': ['snowboarding'],
            'snowmobile': ['snowmobiling'],
            'snowmobiling': ['snowmobiling'],
            'snowkite': ['snowkiting'],
            'snowkiting': ['snowkiting'],
            
            # Extreme sports
            'skydive': ['skydiving'],
            'skydiving': ['skydiving'],
            'parachute': ['parachuting'],
            'parachuting': ['parachuting'],
            'freefall': ['freefall'],
            'base': ['base jumping'],
            'wingsuit': ['wingsuit flying'],
            
            # BMX and tricks
            'bmx': ['bmx'],
            'trick': ['tricks', 'stunts'],
            'tricks': ['tricks', 'stunts'],
            'stunt': ['stunts', 'tricks'],
            'stunts': ['stunts', 'tricks'],
            'flip': ['flips', 'backflip'],
            'flips': ['flips', 'backflip'],
            'backflip': ['backflip', 'flips'],
            
            # Maintenance and preparation
            'maintenance': ['bike_maintenance', 'maintaining'],
            'repair': ['bike_maintenance', 'maintaining'],
            'prepare': ['preparing', 'bike_preparation'],
            'preparation': ['bike_preparation', 'preparing'],
            'setup': ['preparing', 'gearing up'],
            'gear': ['gearing up', 'preparing'],
            
            # Dancing and acrobatics
            'dance': ['dancing', 'breakdancing'],
            'dancing': ['dancing', 'breakdancing'],
            'breakdance': ['breakdancing'],
            'breakdancing': ['breakdancing'],
            'acrobat': ['acrobatics'],
            'acrobatics': ['acrobatics'],
            
            # Exploration and travel
            'explore': ['exploring'],
            'exploring': ['exploring'],
            'travel': ['traveling'],
            'traveling': ['traveling'],
            'adventure': ['exploring', 'extreme sports', 'extreme_sports'],
            
            # Fire and celebration
            'fire': ['bonfire', 'making fire', 'fireworks display'],
            'bonfire': ['bonfire', 'making fire'],
            'fireworks': ['fireworks display'],
            'celebrate': ['celebrating'],
            'celebrating': ['celebrating'],
            
            # Hot air ballooning
            'balloon': ['hot air ballooning'],
            'ballooning': ['hot air ballooning'],
            'hot_air': ['hot air ballooning'],
            
            # Sand sports
            'sandboard': ['sandboarding'],
            'sandboarding': ['sandboarding'],
            'sand_ski': ['sand skiing'],
            'sand_skiing': ['sand skiing'],
            
            # Whale watching
            'whale': ['whale watching'],
            'whales': ['whale watching'],
            'whale_watching': ['whale watching']
        }
        
        # Common meaningless words to filter out from search
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
            'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
            'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
            'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
            'hers', 'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
            'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'any', 'both',
            'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
            'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'now', 'video', 'videos', 'clip', 'clips',
            'footage', 'gopro', 'camera', 'recording', 'shot', 'shots', 'scene', 'scenes', 'action',
            'get', 'give', 'show', 'find', 'search', 'look', 'see', 'watch', 'view', 'top', 'best', 'good',
            'great', 'awesome', 'amazing', 'cool', 'nice', 'please', 'want', 'need', 'like', 'love'
        }
        
        # Scene/Location synonym mapping
        self.scene_synonyms = {
            'track': ['race track', 'racetrack', 'racing_track'],
            'racetrack': ['race track', 'racetrack', 'racing_track'],
            'racing_track': ['race track', 'racetrack', 'racing_track'],
            'circuit': ['race track', 'racetrack', 'racing_track'],
            
            'mountain': ['mountain', 'mountains', 'mountainous'],
            'mountains': ['mountain', 'mountains', 'mountainous'],
            'hill': ['mountain', 'mountains', 'mountainous'],
            'hills': ['mountain', 'mountains', 'mountainous'],
            
            'desert': ['desert', 'sand_dunes', 'sand dune'],
            'sand': ['desert', 'sand_dunes', 'sand dune'],
            'dune': ['sand_dunes', 'sand dune', 'desert'],
            'dunes': ['sand_dunes', 'sand dune', 'desert'],
            
            'snow': ['snow', 'snowy'],
            'snowy': ['snow', 'snowy'],
            'winter': ['snow', 'snowy'],
            
            'water': ['ocean', 'open water', 'underwater'],
            'ocean': ['ocean', 'open water', 'underwater'],
            'sea': ['ocean', 'open water', 'underwater'],
            'underwater': ['underwater', 'ocean', 'open water'],
            
            'beach': ['beach', 'coastal'],
            'coast': ['coastal', 'beach'],
            'coastal': ['coastal', 'beach'],
            
            'park': ['park', 'skate park', 'skatepark'],
            'skatepark': ['skate park', 'skatepark'],
            'skate_park': ['skate park', 'skatepark'],
            
            'street': ['street', 'urban'],
            'city': ['urban', 'street'],
            'urban': ['urban', 'street'],
            
            'field': ['field', 'rural'],
            'countryside': ['rural', 'field'],
            'rural': ['rural', 'field'],
            
            'indoor': ['indoor'],
            'inside': ['indoor'],
            'outdoor': ['outdoor'],
            'outside': ['outdoor'],
            
            'sky': ['sky', 'aerial'],
            'air': ['aerial', 'sky'],
            'aerial': ['aerial', 'sky'],
            
            'night': ['night', 'dark'],
            'dark': ['night', 'dark'],
            'day': ['daytime'],
            'daytime': ['daytime'],
            
            'tropical': ['tropical', 'island'],
            'island': ['island', 'tropical'],
            
            'reef': ['coral reef'],
            'coral': ['coral reef'],
            'coral_reef': ['coral reef']
        }
        
        # Object synonym mapping
        self.object_synonyms = {
            # Vehicles
            'car': ['car', 'race car', 'racecar', 'rally car'],
            'racecar': ['race car', 'racecar', 'car'],
            'race_car': ['race car', 'racecar', 'car'],
            'rally': ['rally car'],
            'vehicle': ['car', 'motorcycle', 'bike'],
            
            'motorcycle': ['motorcycle'],
            'motorbike': ['motorcycle'],
            'bike': ['bike', 'bicycle', 'mountain bike', 'bmx bike', 'mini bike'],
            'bicycle': ['bicycle', 'bike', 'mountain bike'],
            'mountain_bike': ['mountain bike', 'bike', 'bicycle'],
            'bmx': ['bmx bike', 'bike'],
            'scooter': ['scooter'],
            
            # Water vehicles
            'boat': ['boat', 'sailboat', 'dinghy'],
            'sailboat': ['sailboat', 'boat'],
            'kayak': ['kayak'],
            'dinghy': ['dinghy', 'boat'],
            
            # Air vehicles
            'helicopter': ['helicopter'],
            'balloon': ['hot air balloon', 'hot_air_balloon'],
            'hot_air_balloon': ['hot air balloon', 'hot_air_balloon'],
            'parachute': ['parachute'],
            
            # Sports equipment
            'skateboard': ['skateboard'],
            'skis': ['skis', 'ski', 'sand skis'],
            'ski': ['ski', 'skis', 'sand skis'],
            'sand_skis': ['sand skis', 'skis'],
            'snowboard': ['snowboard', 'skis/snowboard'],
            'sandboard': ['sandboard'],
            'snowmobile': ['snowmobile', 'snowcat'],
            'snowcat': ['snowcat', 'snowmobile'],
            
            # Water sports equipment
            'fins': ['fins'],
            'snorkel': ['snorkel mask'],
            'mask': ['snorkel mask'],
            'scuba_gear': ['scuba gear', 'scuba_tank'],
            'scuba_tank': ['scuba_tank', 'scuba gear'],
            'paddle': ['paddle'],
            'sail': ['sail', 'sails'],
            'sails': ['sails', 'sail'],
            'kite': ['kite'],
            
            # Safety equipment
            'helmet': ['helmet', 'racing helmets'],
            'racing_helmet': ['racing helmets', 'helmet'],
            'harness': ['harness'],
            'gear': ['gear', 'racing gear', 'scuba gear'],
            'racing_gear': ['racing gear', 'gear'],
            'suit': ['racing suit', 'racing_suit'],
            'racing_suit': ['racing suit', 'racing_suit'],
            
            # Camera equipment
            'gopro': ['GoPro', 'GoPro camera', 'gopro'],
            'camera': ['camera', 'GoPro camera'],
            'tripod': ['tripod'],
            'selfie_stick': ['selfie stick'],
            
            # Structures and objects
            'ramp': ['ramp', 'skateboard ramp'],
            'skateboard_ramp': ['skateboard ramp', 'ramp'],
            'track': ['track', 'race track', 'racetrack'],
            'wall': ['wall'],
            'building': ['building', 'architecture'],
            'architecture': ['architecture', 'building'],
            
            # Natural objects
            'mountain': ['mountain', 'mountains'],
            'mountains': ['mountains', 'mountain'],
            'tree': ['palm tree', 'palm_trees'],
            'palm': ['palm tree', 'palm_trees'],
            'palm_tree': ['palm tree', 'palm_trees'],
            'sand': ['sand', 'sand dune'],
            'dune': ['sand dune', 'dune'],
            'reef': ['coral reef', 'reef'],
            'coral': ['coral', 'coral reef'],
            'ocean': ['ocean'],
            'whale': ['whale'],
            'shark': ['sharks'],
            'sharks': ['sharks'],
            'fish': ['fish'],
            'turtle': ['sea turtle'],
            'sea_turtle': ['sea turtle'],
            
            # Fire and effects
            'fire': ['fire', 'bonfire'],
            'bonfire': ['bonfire', 'fire'],
            'fireworks': ['fireworks'],
            'sparks': ['sparks'],
            
            # Tools and equipment
            'tools': ['tools'],
            'equipment': ['equipment', 'gear'],
            'rope': ['rope', 'ropes'],
            'ropes': ['ropes', 'rope'],
            'ribbon': ['ribbon', 'ribbons'],
            'ribbons': ['ribbons', 'ribbon'],
            'streamer': ['streamer'],
            
            # Clothing and accessories
            'hat': ['hat', 'cap', 'baseball cap'],
            'cap': ['cap', 'hat', 'baseball cap', 'Red Bull cap'],
            'baseball_cap': ['baseball cap', 'cap', 'hat'],
            'red_bull_cap': ['Red Bull cap', 'cap'],
            'shoes': ['shoes', 'sneakers'],
            'sneakers': ['sneakers', 'shoes'],
            'cloth': ['cloth']
        }
        
        # Initialize models with both API keys
        for i, key in enumerate(GEMINI_KEYS):
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                self.models.append(model)
                print(f"🔑 Initialized Gemini model {i+1}/2 successfully")
            except Exception as e:
                print(f"⚠️ Failed to initialize model {i+1}: {e}")
        
        if not self.models:
            raise Exception("❌ No Gemini models could be initialized!")
        
        self.all_chunks = self._load_all_chunks()
        print(f"🤖 Smart Video Search initialized with {len(self.models)} API keys!")
        print(f"📊 Loaded {len(self.all_chunks)} chunks from {len(set(chunk['video_id'] for chunk in self.all_chunks))} videos")
    
    def get_model(self):
        """Get next available model with round-robin load balancing"""
        model = self.models[self.current_key_index]
        self.current_key_index = (self.current_key_index + 1) % len(self.models)
        return model
    
    def call_gemini_with_fallback(self, prompt: str, operation_name: str = "API call"):
        """Call Gemini with automatic fallback between API keys"""
        last_error = None
        
        # Try all available models
        for attempt in range(len(self.models)):
            try:
                model = self.get_model()
                print(f"🔄 {operation_name} - Trying API key {self.current_key_index}/{len(self.models)}")
                response = model.generate_content(prompt)
                print(f"✅ {operation_name} - Success with API key {self.current_key_index}")
                return response
            except Exception as e:
                last_error = e
                print(f"⚠️ {operation_name} - API key {self.current_key_index} failed: {str(e)[:100]}...")
                continue
        
        # If all models failed, raise the last error
        print(f"❌ {operation_name} - All API keys failed!")
        raise last_error
    
    def _load_all_chunks(self) -> List[Dict]:
        """Load all video chunks from embedding files"""
        all_chunks = []
        
        if not os.path.exists(self.embeddings_dir):
            print(f"❌ Embeddings directory not found: {self.embeddings_dir}")
            return []
        
        # Look for subdirectories containing embedding files
        for video_dir in os.listdir(self.embeddings_dir):
            video_path = os.path.join(self.embeddings_dir, video_dir)
            
            if not os.path.isdir(video_path):
                continue
            
            # Load text embeddings
            text_embeddings_file = os.path.join(video_path, 'text_embeddings.json')
            video_embeddings_file = os.path.join(video_path, 'video_embeddings.json')
            
            if not (os.path.exists(text_embeddings_file) and os.path.exists(video_embeddings_file)):
                continue
            
            try:
                # Load text embeddings (contains tags)
                with open(text_embeddings_file, 'r') as f:
                    text_data = json.load(f)
                
                # Load video embeddings (contains embeddings)
                with open(video_embeddings_file, 'r') as f:
                    video_data = json.load(f)
                
                # Combine data from both files
                text_chunks = {chunk['chunk_id']: chunk for chunk in text_data.get('embeddings', [])}
                video_chunks = {chunk['chunk_id']: chunk for chunk in video_data.get('embeddings', [])}
                
                # Merge chunks
                for chunk_id in text_chunks:
                    if chunk_id in video_chunks:
                        chunk_info = {
                            'video_id': video_dir,
                            'chunk_id': chunk_id,
                            'chunk_file': text_chunks[chunk_id].get('chunk_file', ''),
                            'chunk_number': text_chunks[chunk_id].get('chunk_number', 1),
                            'description': text_chunks[chunk_id].get('description', ''),
                            'scene_tags': text_chunks[chunk_id].get('scene_tags', []),
                            'activity_tags': text_chunks[chunk_id].get('activity_tags', []),
                            'technical_tags': text_chunks[chunk_id].get('technical_tags', []),
                            'mood_tags': text_chunks[chunk_id].get('mood_tags', []),
                            'object_tags': text_chunks[chunk_id].get('object_tags', []),
                            'text_embedding': text_chunks[chunk_id].get('embedding', []),
                            'video_embedding': video_chunks[chunk_id].get('embedding', [])
                        }
                        all_chunks.append(chunk_info)
                        
            except Exception as e:
                print(f"⚠️ Error loading {video_dir}: {e}")
        
        return all_chunks
    
    def extract_and_map_keywords(self, user_input: str) -> Dict:
        """Extract Primary Keywords (must-have) and Context Tags (nice-to-have) for better prioritization"""
        
        prompt = f"""
        Analyze the following user input and extract key information into two priority levels:
        
        User Input: "{user_input}"
        
        Extract and categorize into TWO PRIORITY LEVELS:
        
        1. PRIMARY KEYWORDS (MUST-HAVE - Core intent, non-negotiable):
           - Main activity (driving, cycling, skiing, etc.)
           - Main object (car, bike, skis, etc.)
           - These define what the video MUST contain
        
        2. CONTEXT TAGS (NICE-TO-HAVE - Additional context, can be flexible):
           - Locations/scenes (track, snow, mountain, etc.)
           - Additional descriptors
           - These refine the search but are not mandatory
        
        3. N (NUMBER) - If user asks for "top N", "N videos", etc. Default to 5 if not specified.
        
        Guidelines:
        - PRIMARY KEYWORDS are the core intent - video MUST have these
        - CONTEXT TAGS provide additional context but video can still be relevant without all of them
        - Be specific and actionable
        - Ignore filler words like "give me", "video", "of", etc.
        
        Examples:
        - "driving car on racing track" → primary: ["driving", "car"], context: ["racing track"]
        - "cycling bike in mountains" → primary: ["cycling", "bike"], context: ["mountains"]
        - "skiing downhill in snow" → primary: ["skiing"], context: ["downhill", "snow"]
        - "car racing on track and in snow" → primary: ["car", "racing"], context: ["track", "snow"]
        
        The idea: First filter by PRIMARY (must match), then rank by CONTEXT + embedding similarity.
        
        Respond in JSON format:
        {{
            "n": 5,
            "primary_keywords": ["keyword1", "keyword2"],
            "context_tags": ["tag1", "tag2", "tag3"]
        }}
        """
        
        try:
            response = self.call_gemini_with_fallback(prompt, "Keyword Extraction")
            response_text = response.text.strip()
            
            # Clean JSON response
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            result = json.loads(response_text)
            
            # Ensure n is present and is an integer, default to 5 if not found
            if 'n' not in result or not isinstance(result['n'], int) or result['n'] <= 0:
                result['n'] = 5
            
            # Ensure required categories exist
            if 'primary_keywords' not in result:
                result['primary_keywords'] = []
            if 'context_tags' not in result:
                result['context_tags'] = []
            
            return result
            
        except Exception as e:
            print(f"❌ Error extracting keywords: {e}")
            # Robust fallback: Parse user input locally
            print(f"🔄 Using local fallback keyword extraction...")
            
            user_lower = user_input.lower()
            
            # Extract N from query
            n = 5  # default
            import re
            n_match = re.search(r'top\s+(\d+)|(\d+)\s+video|(\d+)\s+best', user_lower)
            if n_match:
                n = int(n_match.group(1) or n_match.group(2) or n_match.group(3))
            
            # Extract primary keywords (activities + objects)
            primary_keywords = []
            
            # Common activities
            activities = ['driving', 'racing', 'cycling', 'skiing', 'climbing', 'surfing', 'flying', 'jumping', 'running']
            for activity in activities:
                if activity in user_lower:
                    primary_keywords.append(activity)
            
            # Common objects
            objects = ['car', 'bike', 'bicycle', 'motorcycle', 'truck', 'boat', 'plane', 'ski', 'board']
            for obj in objects:
                if obj in user_lower:
                    primary_keywords.append(obj)
            
            # Extract context tags (locations/scenes)
            context_tags = []
            
            # Common scenes/locations
            scenes = ['track', 'racing track', 'snow', 'mountain', 'beach', 'desert', 'forest', 'city', 'indoor', 'outdoor']
            for scene in scenes:
                if scene in user_lower:
                    context_tags.append(scene)
            
            # If no primary keywords found, try to extract from common patterns
            if not primary_keywords:
                if 'video' in user_lower:
                    # Look for patterns like "video of X" or "X video"
                    words = user_lower.split()
                    for i, word in enumerate(words):
                        if word in ['of', 'with', 'showing']:
                            if i + 1 < len(words):
                                primary_keywords.append(words[i + 1])
            
            return {
                "n": n,
                "primary_keywords": primary_keywords,
                "context_tags": context_tags
            }
    
    def clean_query_for_embedding(self, user_input: str, search_criteria: Dict) -> str:
        """Create focused query using primary keywords and context tags"""
        
        # Extract primary and context
        primary_keywords = search_criteria.get('primary_keywords', [])
        context_tags = search_criteria.get('context_tags', [])
        
        prompt = f"""
        Create a focused search query using the extracted primary keywords and context tags.
        
        Original User Query: "{user_input}"
        
        Primary Keywords (must include): {primary_keywords}
        Context Tags (nice to include): {context_tags}
        
        Guidelines:
        1. ALWAYS include all primary keywords in the refined query
        2. Include 1-2 most relevant context tags
        3. Keep it concise but descriptive (10-15 words max)
        4. Make it natural and searchable
        5. Focus on what the user actually wants to see
        
        Examples:
        - Primary: ["driving", "car"], Context: ["racing track"] → "car driving on racing track"
        - Primary: ["cycling", "bike"], Context: ["mountains"] → "bike cycling in mountains"
        - Primary: ["skiing"], Context: ["downhill", "snow"] → "skiing downhill on snowy slopes"
        
        Return ONLY the focused refined query (10-15 words), no quotes or formatting.
        """
        
        try:
            response = self.call_gemini_with_fallback(prompt, "Query Refinement")
            refined_query = response.text.strip()
            
            # Remove any quotes or extra formatting
            refined_query = refined_query.replace('"', '').replace("'", '').strip()
            
            # Fallback if response is too long or seems wrong
            if len(refined_query.split()) > 20 or refined_query.lower() in ['none', 'n/a', 'null']:
                raise Exception("Refined query too long or invalid")
            
            return refined_query
            
        except Exception as e:
            print(f"❌ Error refining query with Gemini: {e}")
            # Simple focused fallback using primary + context
            print(f"🔄 Using local fallback query refinement...")
            
            query_parts = []
            
            # Always add primary keywords
            if primary_keywords:
                query_parts.extend(primary_keywords[:2])  # Take first 2 primary
            
            # Add most relevant context
            if context_tags:
                if 'racing track' in context_tags or 'track' in context_tags:
                    query_parts.append('on racing track')
                elif 'snow' in context_tags:
                    query_parts.append('in snow')
                elif context_tags:
                    query_parts.append(context_tags[0])
            
            fallback_query = ' '.join(query_parts)
            return fallback_query if fallback_query else user_input
    
    def generate_query_embedding(self, cleaned_query: str) -> List[float]:
        """Generate 768D text embedding for the cleaned query"""
        
        try:
            # Use text-embedding-004 to get 768D embedding (matches text embeddings in chunks)
            embedding_response = genai.embed_content(
                model="models/text-embedding-004",
                content=cleaned_query,
                task_type="retrieval_query"
            )
            
            query_embedding = embedding_response['embedding']
            print(f"📊 Generated query embedding: {len(query_embedding)}D (text embedding)")
            
            return query_embedding
            
        except Exception as e:
            print(f"❌ Error generating query embedding: {e}")
            # Return zero vector as fallback
            return [0.0] * 768
    
    def calculate_multiple_similarities(self, query_embedding: List[float], chunk: Dict, cleaned_query: str) -> Dict:
        """Calculate only text embedding and description overlap similarities"""
        
        similarities = {}
        
        # 1. Text Embedding Similarity (primary)
        text_embedding = chunk.get('text_embedding', [])
        if len(text_embedding) == 768 and len(query_embedding) == 768:
            text_sim = cosine_similarity([query_embedding], [text_embedding])[0][0]
            similarities['text_embedding'] = float(text_sim)
        else:
            similarities['text_embedding'] = 0.0
        
        # 2. Description Text Similarity (secondary)
        description = chunk.get('description', '').lower()
        query_words = set(cleaned_query.lower().split())
        desc_words = set(description.split())
        
        if query_words and desc_words:
            # Jaccard similarity for text overlap
            intersection = len(query_words.intersection(desc_words))
            union = len(query_words.union(desc_words))
            jaccard_sim = intersection / union if union > 0 else 0
            similarities['description_overlap'] = jaccard_sim
        else:
            similarities['description_overlap'] = 0.0
        
        # 3. Combined Score with only embedding + description
        combined_score = (
            similarities['text_embedding'] * 0.7 +      # Primary: semantic similarity
            similarities['description_overlap'] * 0.3   # Secondary: text overlap
        )
        similarities['combined_score'] = combined_score
        
        return similarities
    
    def get_available_activities(self) -> List[str]:
        """Get list of available activities in the dataset"""
        activities = set()
        for chunk in self.all_chunks:
            activities.update(chunk.get('activity_tags', []))
        return sorted(list(activities))
    
    def expand_keywords_with_synonyms(self, keywords: List[str]) -> List[str]:
        """Expand keywords using comprehensive synonym mapping and filter out stop words"""
        expanded_keywords = set()
        
        for keyword in keywords:
            keyword_lower = keyword.lower().strip()
            
            # Skip stop words (common meaningless words)
            if keyword_lower in self.stop_words:
                print(f"🚫 Filtered out stop word: '{keyword}'")
                continue
            
            # Add original keyword if it's meaningful
            expanded_keywords.add(keyword_lower)
            
            # Check activity synonyms
            if keyword_lower in self.activity_synonyms:
                expanded_keywords.update(self.activity_synonyms[keyword_lower])
                print(f"🔄 Activity expansion: '{keyword}' → {self.activity_synonyms[keyword_lower]}")
            
            # Check scene synonyms
            if keyword_lower in self.scene_synonyms:
                expanded_keywords.update(self.scene_synonyms[keyword_lower])
                print(f"🌍 Scene expansion: '{keyword}' → {self.scene_synonyms[keyword_lower]}")
            
            # Check object synonyms
            if keyword_lower in self.object_synonyms:
                expanded_keywords.update(self.object_synonyms[keyword_lower])
                print(f"🎯 Object expansion: '{keyword}' → {self.object_synonyms[keyword_lower]}")
            
            # Handle compound words and partial matches
            # For example, "motorbike racing" should match both "motorbike" and "racing"
            words_in_keyword = keyword_lower.split()
            if len(words_in_keyword) > 1:
                for word in words_in_keyword:
                    if word not in self.stop_words:
                        expanded_keywords.add(word)
                        
                        # Check synonyms for each word
                        if word in self.activity_synonyms:
                            expanded_keywords.update(self.activity_synonyms[word])
                        if word in self.scene_synonyms:
                            expanded_keywords.update(self.scene_synonyms[word])
                        if word in self.object_synonyms:
                            expanded_keywords.update(self.object_synonyms[word])
        
        # Remove any stop words that might have been added through synonyms
        expanded_keywords = {kw for kw in expanded_keywords if kw not in self.stop_words}
        
        return list(expanded_keywords)
    
    def search_chunks(self, search_criteria: Dict, user_query: str, cleaned_query: str) -> List[Dict]:
        """Search using PRIMARY keywords as mandatory filter, then rank by CONTEXT + embedding similarity"""
        
        print(f"\n🔍 Searching through {len(self.all_chunks)} chunks...")
        print(f"🧹 Using refined query: '{cleaned_query}'")
        print(f"🎯 Priority-based search: PRIMARY keywords (mandatory) + CONTEXT tags (ranking)")
        
        # Step 1: Generate query embedding using the cleaned query
        query_embedding = self.generate_query_embedding(cleaned_query)
        
        # Step 2: Filter chunks based on PRIMARY keywords first (mandatory)
        primary_keywords = search_criteria.get('primary_keywords', [])
        context_tags = search_criteria.get('context_tags', [])
        
        # Filter out generic/personal words that shouldn't be used for filtering
        filtered_primary_keywords = []
        generic_words = ['me', 'my', 'i', 'we', 'us', 'our', 'video', 'videos', 'top', 'best']
        
        for keyword in primary_keywords:
            if keyword.lower() not in generic_words:
                filtered_primary_keywords.append(keyword)
        
        # Expand keywords with synonyms
        expanded_keywords = self.expand_keywords_with_synonyms(filtered_primary_keywords)
        
        print(f"🔑 Filtering by PRIMARY keywords (mandatory): {filtered_primary_keywords}")
        print(f"🔄 Expanded to include synonyms: {expanded_keywords}")
        primary_filtered_chunks = []
        
        for chunk in self.all_chunks:
            # Check if chunk matches ANY of the expanded keywords
            found_match = False
            
            if len(expanded_keywords) == 0:
                # If no meaningful primary keywords, include all chunks
                primary_filtered_chunks.append(chunk)
                continue
            
            # Check activity and object tags specifically (more strict matching)
            activity_tags = [tag.lower() for tag in chunk.get('activity_tags', [])]
            object_tags = [tag.lower() for tag in chunk.get('object_tags', [])]
            scene_tags = [tag.lower() for tag in chunk.get('scene_tags', [])]
            
            # Check if any expanded keyword matches any tag
            for expanded_keyword in expanded_keywords:
                keyword_lower = expanded_keyword.lower()
                
                # Check activity tags (most important)
                for activity_tag in activity_tags:
                    if (keyword_lower in activity_tag or 
                        activity_tag in keyword_lower or
                        keyword_lower == activity_tag):
                        found_match = True
                        break
                
                if found_match:
                    break
                
                # Check object tags if not found in activity
                for object_tag in object_tags:
                    if (keyword_lower in object_tag or 
                        object_tag in keyword_lower or
                        keyword_lower == object_tag):
                        found_match = True
                        break
                
                if found_match:
                    break
                
                # Check scene tags as last resort
                for scene_tag in scene_tags:
                    if (keyword_lower in scene_tag or 
                        scene_tag in keyword_lower or
                        keyword_lower == scene_tag):
                        found_match = True
                        break
                
                if found_match:
                    break
            
            if found_match:
                primary_filtered_chunks.append(chunk)
        
        print(f"🔑 Primary keyword filtering: {len(self.all_chunks)} → {len(primary_filtered_chunks)} chunks")
        
        # Check if we have any relevant results
        if len(primary_filtered_chunks) == 0 and filtered_primary_keywords:
            print(f"❌ No videos found matching primary keywords: {filtered_primary_keywords}")
            print(f"🔄 Even with synonyms: {expanded_keywords}")
            print(f"💡 Available activities in dataset: {self.get_available_activities()}")
            return []  # Return empty list instead of all chunks
        
        # Step 3: Rank filtered chunks by CONTEXT + embedding similarity
        print(f"📊 Ranking by CONTEXT tags + semantic similarity...")
        scored_chunks = []
        
        for chunk in primary_filtered_chunks:
            # Calculate embedding + description similarities
            similarities = self.calculate_multiple_similarities(query_embedding, chunk, cleaned_query)
            
            # Calculate context relevance score
            context_score = 0
            if context_tags:
                all_chunk_tags = []
                for tag_type in ['activity_tags', 'scene_tags', 'object_tags']:
                    all_chunk_tags.extend(chunk.get(tag_type, []))
                
                chunk_text = ' '.join(all_chunk_tags).lower()
                chunk_description = chunk.get('description', '').lower()
                
                context_matches = 0
                for context_tag in context_tags:
                    context_lower = context_tag.lower().strip()
                    
                    # Skip stop words in context tags too
                    if context_lower in self.stop_words:
                        continue
                    
                    # Direct matching
                    found_context_match = False
                    
                    # Check direct matches in tags and description
                    if (context_lower in chunk_text or 
                        context_lower in chunk_description or
                        any(context_lower in tag.lower() for tag in all_chunk_tags)):
                        found_context_match = True
                    
                    # If no direct match, try synonym expansion for context tags
                    if not found_context_match:
                        # Expand context tag with synonyms
                        expanded_context = set([context_lower])
                        
                        # Check all synonym mappings for context tag
                        if context_lower in self.activity_synonyms:
                            expanded_context.update(self.activity_synonyms[context_lower])
                        if context_lower in self.scene_synonyms:
                            expanded_context.update(self.scene_synonyms[context_lower])
                        if context_lower in self.object_synonyms:
                            expanded_context.update(self.object_synonyms[context_lower])
                        
                        # Check if any expanded context matches
                        for expanded_ctx in expanded_context:
                            if (expanded_ctx in chunk_text or 
                                expanded_ctx in chunk_description or
                                any(expanded_ctx in tag.lower() for tag in all_chunk_tags)):
                                found_context_match = True
                                break
                    
                    if found_context_match:
                        context_matches += 1
                
                context_score = context_matches / len(context_tags) if context_tags else 0
            
            # Combined score: embedding (50%) + description (30%) + context (20%)
            combined_score = (
                similarities['text_embedding'] * 0.5 +
                similarities['description_overlap'] * 0.3 +
                context_score * 0.2
            )
            
            # Add chunk with all scores
            scored_chunks.append({
                **chunk,
                'text_embedding_similarity': similarities['text_embedding'],
                'description_overlap': similarities['description_overlap'],
                'context_relevance': context_score,
                'combined_score': combined_score,
                'embedding_similarity': similarities['text_embedding']  # Keep for backward compatibility
            })
        
        # Step 4: Sort by combined score
        scored_chunks.sort(key=lambda x: x['combined_score'], reverse=True)
        
        # Return top N results
        n = search_criteria.get('n', 5)
        top_chunks = scored_chunks[:n]
        
        print(f"📊 Ranked {len(scored_chunks)} relevant chunks, returning top {len(top_chunks)}")
        print(f"🎯 Scoring: Priority-based (Embedding 50% + Description 30% + Context 20%)")
        
        return top_chunks
    
    def calculate_chunk_timing(self, chunk_number: int) -> tuple:
        """Calculate start and end time for a chunk (10 seconds per chunk)"""
        start_time = (chunk_number - 1) * 10  # Chunk 1 = 0-10s, Chunk 2 = 10-20s, etc.
        end_time = chunk_number * 10
        return start_time, end_time
    
    def generate_chunk_summary(self, chunk: Dict, user_query: str) -> str:
        """Generate AI summary explaining why this chunk matches the user query"""
        
        # Prepare chunk information for Gemini
        chunk_info = f"""
        Chunk ID: {chunk.get('chunk_id', '')}
        Video ID: {chunk.get('video_id', '')}
        Description: {chunk.get('description', 'No description available')}
        Scene Tags: {', '.join(chunk.get('scene_tags', []))}
        Activity Tags: {', '.join(chunk.get('activity_tags', []))}
        Object Tags: {', '.join(chunk.get('object_tags', []))}
        Technical Tags: {', '.join(chunk.get('technical_tags', []))}
        Mood Tags: {', '.join(chunk.get('mood_tags', []))}
        Similarity Score: {chunk.get('embedding_similarity', 0):.4f}
        """
        
        prompt = f"""
        Explain in 2-3 lines why this video chunk was selected for the user's query.
        
        User Query: "{user_query}"
        
        Chunk Information:
        {chunk_info}
        
        Write a concise explanation focusing on:
        1. What specific elements match the user's request
        2. Why this chunk is relevant
        3. Key activities/objects/scenes that align with the query
        
        Keep it conversational and specific. Start with "Selected because..."
        
        Example: "Selected because it shows racing action on a track with a car, matching your request for driving content. The POV camera angle and fast-paced technical style create an exciting racing experience."
        """
        
        try:
            response = self.call_gemini_with_fallback(prompt, "AI Summary Generation")
            summary = response.text.strip()
            
            # Clean up the response
            if summary.startswith('"') and summary.endswith('"'):
                summary = summary[1:-1]
            
            return summary
            
        except Exception as e:
            print(f"⚠️ Error generating summary for {chunk.get('chunk_id', '')}: {e}")
            # Fallback summary
            activity_tags = chunk.get('activity_tags', [])
            scene_tags = chunk.get('scene_tags', [])
            object_tags = chunk.get('object_tags', [])
            
            fallback = f"Selected because it contains {', '.join(activity_tags[:2])} activities"
            if scene_tags:
                fallback += f" in {', '.join(scene_tags[:2])} settings"
            if object_tags:
                fallback += f" featuring {', '.join(object_tags[:2])}"
            fallback += ", which matches your search criteria."
            
            return fallback
    
    def generate_chunk_summary_parallel(self, chunk: Dict, user_query: str, api_key_index: int) -> str:
        """Generate AI summary using a specific API key (for parallel processing)"""
        
        # Prepare chunk information for Gemini
        chunk_info = f"""
        Chunk ID: {chunk.get('chunk_id', '')}
        Video ID: {chunk.get('video_id', '')}
        Description: {chunk.get('description', 'No description available')}
        Similarity Score: {chunk.get('embedding_similarity', 0):.4f}
        """
        
        prompt = f"""
        Explain in 2-3 lines why this video chunk was selected for the user's query.
        
        User Query: "{user_query}"
        
        Chunk Information:
        {chunk_info}
        
        Write a concise explanation focusing on:
        1. What specific elements match the user's request
        2. Why this chunk is relevant
        3. Key activities/objects/scenes that align with the query
        
        Keep it conversational and specific. Start with "Selected because..."
        
        Example: "Selected because it shows racing action on a track with a car, matching your request for driving content. The POV camera angle and fast-paced technical style create an exciting racing experience."
        """
        
        try:
            # Use specific API key for this request
            genai.configure(api_key=GEMINI_KEYS[api_key_index])
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            print(f"🔄 Generating summary for {chunk.get('chunk_id', '')} using API key {api_key_index + 1}")
            response = model.generate_content(prompt)
            summary = response.text.strip()
            
            # Clean up the response
            if summary.startswith('"') and summary.endswith('"'):
                summary = summary[1:-1]
            
            print(f"✅ Summary completed for {chunk.get('chunk_id', '')} with API key {api_key_index + 1}")
            return summary
            
        except Exception as e:
            print(f"⚠️ Error generating summary for {chunk.get('chunk_id', '')} with API key {api_key_index + 1}: {e}")
            # Fallback summary
            fallback = f"Selected because it matches your search criteria for {user_query}."
            return fallback
    
    def generate_summaries_parallel(self, chunks: List[Dict], user_query: str) -> List[str]:
        """Generate AI summaries for all chunks in parallel using both API keys"""
        
        print(f"🚀 Generating {len(chunks)} AI summaries in parallel using {len(self.models)} API keys...")
        
        summaries = [''] * len(chunks)  # Pre-allocate list to maintain order
        
        # Create thread pool with max workers = number of API keys
        with ThreadPoolExecutor(max_workers=len(self.models)) as executor:
            # Submit all summary generation tasks
            future_to_index = {}
            
            for i, chunk in enumerate(chunks):
                # Distribute chunks across API keys
                api_key_index = i % len(self.models)
                future = executor.submit(self.generate_chunk_summary_parallel, chunk, user_query, api_key_index)
                future_to_index[future] = i
            
            # Collect results as they complete
            completed_count = 0
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                try:
                    summary = future.result()
                    summaries[index] = summary
                    completed_count += 1
                    print(f"📝 Completed {completed_count}/{len(chunks)} summaries")
                except Exception as e:
                    print(f"❌ Failed to generate summary for chunk {index}: {e}")
                    summaries[index] = f"Selected because it matches your search criteria."
        
        print(f"🎉 All {len(chunks)} summaries generated in parallel!")
        return summaries
    
    def format_results(self, chunks: List[Dict], search_criteria: Dict, user_query: str, cleaned_query: str) -> List[Dict]:
        """Format results in the requested output format with timing and summaries"""
        
        if not chunks:
            print(f"📋 No results to format - returning empty list")
            return []
        
        print(f"🤖 Generating AI summaries for {len(chunks)} selected chunks...")
        
        # Generate all summaries in parallel
        summaries = self.generate_summaries_parallel(chunks, user_query)
        
        formatted_results = []
        
        for i, chunk in enumerate(chunks):
            print(f"📋 Formatting result {i+1}/{len(chunks)} for {chunk.get('chunk_id', '')}")
            
            # Remove .mp4 extension from chunk_file
            chunk_file = chunk.get('chunk_file', '').replace('.mp4', '')
            
            # Calculate timing based on chunk number
            chunk_number = chunk.get('chunk_number', 1)
            start_time, end_time = self.calculate_chunk_timing(chunk_number)
            
            # Use pre-generated summary
            ai_summary = summaries[i]
            
            result = {
                "n": search_criteria.get('n', 5),
                "original_query": user_query,
                "refined_query": cleaned_query,
                "primary_keywords": search_criteria.get('primary_keywords', []),
                "context_tags": search_criteria.get('context_tags', []),
                "video_id": chunk.get('video_id', ''),
                "chunk_file": chunk_file,
                "chunk_id": chunk.get('chunk_id', ''),
                "chunk_number": chunk_number,
                "start_time": start_time,
                "end_time": end_time,
                "description": chunk.get('description', ''),
                "activity_tags": chunk.get('activity_tags', []),
                "scene_tags": chunk.get('scene_tags', []),
                "object_tags": chunk.get('object_tags', []),
                "embedding_similarity": round(chunk.get('embedding_similarity', 0), 4),
                "text_embedding_similarity": round(chunk.get('text_embedding_similarity', 0), 4),
                "description_overlap": round(chunk.get('description_overlap', 0), 4),
                "context_relevance": round(chunk.get('context_relevance', 0), 4),
                "score": round(chunk.get('combined_score', 0), 4),
                "ai_summary": ai_summary
            }
            
            formatted_results.append(result)
        
        return formatted_results
    
    def detect_multiple_conditions(self, user_input: str, search_criteria: Dict) -> List[Dict]:
        """Detect if query has multiple conditions (like 'on track and in snow') and split them"""
        
        prompt = f"""
        Analyze this user query to detect if it contains multiple distinct location/scene conditions connected by "and".
        
        User Query: "{user_input}"
        Extracted Tags: {search_criteria}
        
        Look for patterns like:
        - "on track and in snow" (2 conditions: track, snow)
        - "in mountains and at beach" (2 conditions: mountains, beach)
        - "indoor and outdoor" (2 conditions: indoor, outdoor)
        - "racing and cycling" (2 conditions: racing activity, cycling activity)
        
        If multiple conditions are found, split them into separate search scenarios.
        If only one condition, return single scenario.
        
        Guidelines:
        1. Look for "and" connecting different locations/scenes/activities
        2. Each condition should be a distinct search scenario
        3. Preserve the main activity/object but vary the scene/location
        4. Don't split if "and" connects similar things (like "car and vehicle")
        
        Examples:
        - "driving car on track and in snow" → 2 conditions: ["driving car on track", "driving car in snow"]
        - "cycling in mountains and desert" → 2 conditions: ["cycling in mountains", "cycling in desert"]  
        - "racing car fast" → 1 condition: ["racing car fast"]
        - "car and vehicle racing" → 1 condition: ["car vehicle racing"] (similar objects)
        
        Return JSON format:
        {{
            "has_multiple_conditions": true/false,
            "conditions": [
                {{
                    "query": "condition 1 query",
                    "focus": "what makes this condition unique"
                }},
                {{
                    "query": "condition 2 query", 
                    "focus": "what makes this condition unique"
                }}
            ]
        }}
        """
        
        try:
            response = self.call_gemini_with_fallback(prompt, "Multiple Condition Detection")
            response_text = response.text.strip()
            
            # Clean JSON response
            if response_text.startswith('```json'):
                response_text = response_text[7:-3]
            elif response_text.startswith('```'):
                response_text = response_text[3:-3]
            
            result = json.loads(response_text)
            
            # Validate result
            if not isinstance(result.get('has_multiple_conditions'), bool):
                result['has_multiple_conditions'] = False
            
            if not isinstance(result.get('conditions'), list):
                result['conditions'] = [{"query": user_input, "focus": "single condition"}]
            
            return result
            
        except Exception as e:
            print(f"❌ Error detecting multiple conditions: {e}")
            # Fallback: Simple local detection of "and" patterns
            print(f"🔄 Using local fallback condition detection...")
            
            user_lower = user_input.lower()
            
            # Look for "and" patterns that suggest multiple conditions
            if ' and ' in user_lower:
                # Split by "and" and check if they represent different conditions
                parts = user_lower.split(' and ')
                
                # Check if parts contain different location/scene words
                location_words = ['track', 'snow', 'mountain', 'beach', 'desert', 'indoor', 'outdoor', 'city', 'forest']
                
                conditions = []
                for part in parts:
                    part = part.strip()
                    if any(loc in part for loc in location_words):
                        # Create condition query by combining with main activity/object
                        main_words = []
                        for word in ['driving', 'racing', 'cycling', 'car', 'bike']:
                            if word in user_lower:
                                main_words.append(word)
                        
                        if main_words:
                            condition_query = ' '.join(main_words) + ' ' + part
                            conditions.append({
                                "query": condition_query,
                                "focus": part
                            })
                
                if len(conditions) > 1:
                    return {
                        "has_multiple_conditions": True,
                        "conditions": conditions
                    }
            
            # Fallback: treat as single condition
            return {
                "has_multiple_conditions": False,
                "conditions": [{"query": user_input, "focus": "single condition"}]
            }
    
    def search_single_condition(self, condition_query: str, original_criteria: Dict, results_per_condition: int) -> List[Dict]:
        """Search for a single condition with specified number of results"""
        
        print(f"\n🔍 Searching condition: '{condition_query}'")
        
        # Extract keywords for this specific condition
        condition_criteria = self.extract_and_map_keywords(condition_query)
        condition_criteria['n'] = results_per_condition  # Set results per condition
        
        print(f"🎯 Condition Criteria:")
        print(f"   Primary Keywords (must-have): {condition_criteria['primary_keywords']}")
        print(f"   Context Tags (nice-to-have): {condition_criteria['context_tags']}")
        
        # Create refined query for this condition
        refined_query = self.clean_query_for_embedding(condition_query, condition_criteria)
        print(f"🧹 Refined Query: '{refined_query}'")
        
        # Search for this condition
        matching_chunks = self.search_chunks(condition_criteria, condition_query, refined_query)
        
        # Format results for this condition
        formatted_results = self.format_results(matching_chunks, original_criteria, condition_query, refined_query)
        
        return formatted_results
    
    def deduplicate_results(self, all_results: List[Dict]) -> List[Dict]:
        """Remove duplicate results based on chunk_id"""
        seen_chunks = set()
        deduplicated = []
        
        for result in all_results:
            chunk_id = result.get('chunk_id', '')
            if chunk_id not in seen_chunks:
                seen_chunks.add(chunk_id)
                deduplicated.append(result)
            else:
                print(f"🔄 Removing duplicate: {chunk_id}")
        
        return deduplicated
    
    def search_single_condition_parallel(self, condition_query: str, original_criteria: Dict, results_per_condition: int, api_key_index: int) -> List[Dict]:
        """Search for a single condition with specified number of results using specific API key"""
        
        print(f"\n🔍 Searching condition: '{condition_query}' with API key {api_key_index + 1}")
        
        # Extract keywords for this specific condition using specific API key
        try:
            genai.configure(api_key=GEMINI_KEYS[api_key_index])
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Use the existing keyword extraction logic but with specific API key
            condition_criteria = self.extract_and_map_keywords(condition_query)
            condition_criteria['n'] = results_per_condition  # Set results per condition
            
            print(f"🎯 Condition Criteria (API key {api_key_index + 1}):")
            print(f"   Primary Keywords (must-have): {condition_criteria['primary_keywords']}")
            print(f"   Context Tags (nice-to-have): {condition_criteria['context_tags']}")
            
            # Create refined query for this condition
            refined_query = self.clean_query_for_embedding(condition_query, condition_criteria)
            print(f"🧹 Refined Query (API key {api_key_index + 1}): '{refined_query}'")
            
            # Search for this condition
            matching_chunks = self.search_chunks(condition_criteria, condition_query, refined_query)
            
            # Format results for this condition (but don't generate summaries yet)
            formatted_results = []
            for chunk in matching_chunks:
                # Remove .mp4 extension from chunk_file
                chunk_file = chunk.get('chunk_file', '').replace('.mp4', '')
                
                # Calculate timing based on chunk number
                chunk_number = chunk.get('chunk_number', 1)
                start_time, end_time = self.calculate_chunk_timing(chunk_number)
                
                result = {
                    "n": original_criteria.get('n', 5),
                    "original_query": condition_query,
                    "refined_query": refined_query,
                    "primary_keywords": original_criteria.get('primary_keywords', []),
                    "context_tags": original_criteria.get('context_tags', []),
                    "video_id": chunk.get('video_id', ''),
                    "chunk_file": chunk_file,
                    "chunk_id": chunk.get('chunk_id', ''),
                    "chunk_number": chunk_number,
                    "start_time": start_time,
                    "end_time": end_time,
                    "description": chunk.get('description', ''),
                    "activity_tags": chunk.get('activity_tags', []),
                    "scene_tags": chunk.get('scene_tags', []),
                    "object_tags": chunk.get('object_tags', []),
                    "embedding_similarity": round(chunk.get('embedding_similarity', 0), 4),
                    "text_embedding_similarity": round(chunk.get('text_embedding_similarity', 0), 4),
                    "description_overlap": round(chunk.get('description_overlap', 0), 4),
                    "context_relevance": round(chunk.get('context_relevance', 0), 4),
                    "score": round(chunk.get('combined_score', 0), 4),
                    "ai_summary": ""  # Will be filled later in parallel
                }
                
                formatted_results.append(result)
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ Error in parallel condition search with API key {api_key_index + 1}: {e}")
            return []
    
    def search(self, user_input: str) -> List[Dict]:
        """Complete search pipeline with multiple condition detection"""
        
        print(f"📝 User Query: {user_input}")
        
        # Step 1: Extract and map keywords from original query
        print(f"\n🧠 Step 1: Extracting keywords with Gemini...")
        search_criteria = self.extract_and_map_keywords(user_input)
        
        print(f"🎯 Extracted Criteria:")
        print(f"   N: {search_criteria['n']}")
        print(f"   Primary Keywords (must-have): {search_criteria['primary_keywords']}")
        print(f"   Context Tags (nice-to-have): {search_criteria['context_tags']}")
        
        # Step 2: Detect multiple conditions
        print(f"\n🔄 Step 2: Detecting multiple conditions...")
        condition_analysis = self.detect_multiple_conditions(user_input, search_criteria)
        
        has_multiple = condition_analysis['has_multiple_conditions']
        conditions = condition_analysis['conditions']
        
        print(f"🎯 Multiple Conditions Detected: {has_multiple}")
        print(f"📋 Number of Conditions: {len(conditions)}")
        
        all_results = []
        
        if has_multiple and len(conditions) > 1:
            # Multiple conditions: distribute N among conditions and process in parallel
            total_n = search_criteria['n']
            base_results_per_condition = total_n // len(conditions)
            extra_results = total_n % len(conditions)  # Handle odd numbers
            
            print(f"🔢 Distributing N={total_n} among {len(conditions)} conditions:")
            print(f"   Base results per condition: {base_results_per_condition}")
            print(f"   Extra results for first {extra_results} condition(s): +1 each")
            
            # Process conditions in parallel
            print(f"🚀 Processing {len(conditions)} conditions in parallel...")
            
            with ThreadPoolExecutor(max_workers=min(len(conditions), len(GEMINI_KEYS))) as executor:
                future_to_condition = {}
                
                for i, condition in enumerate(conditions, 1):
                    # Give extra results to first conditions when N is odd
                    results_for_this_condition = base_results_per_condition
                    if i <= extra_results:
                        results_for_this_condition += 1
                    
                    print(f"🎯 CONDITION {i}/{len(conditions)}: {condition['focus']} - {results_for_this_condition} results")
                    
                    # Submit parallel condition search
                    api_key_index = (i - 1) % len(GEMINI_KEYS)
                    future = executor.submit(
                        self.search_single_condition_parallel,
                        condition['query'], 
                        search_criteria, 
                        results_for_this_condition,
                        api_key_index
                    )
                    future_to_condition[future] = (i, condition)
                
                # Collect results as they complete
                for future in as_completed(future_to_condition):
                    condition_number, condition = future_to_condition[future]
                    try:
                        condition_results = future.result()
                        
                        # Add condition info to results
                        for result in condition_results:
                            result['condition_number'] = condition_number
                            result['condition_focus'] = condition['focus']
                            result['total_conditions'] = len(conditions)
                        
                        all_results.extend(condition_results)
                        print(f"✅ Completed condition {condition_number}: {condition['focus']}")
                        
                    except Exception as e:
                        print(f"❌ Failed condition {condition_number}: {e}")
            
            # Generate all summaries in parallel at the end
            if all_results:
                print(f"\n🚀 Generating summaries for all {len(all_results)} results in parallel...")
                all_queries = [result['original_query'] for result in all_results]
                summaries = self.generate_summaries_parallel(all_results, user_input)
                
                # Update results with summaries
                for i, result in enumerate(all_results):
                    result['ai_summary'] = summaries[i]
        
        else:
            # Single condition: use original logic
            print(f"🎯 Single condition detected, using standard search")
            
            # Step 2: Create focused refined query
            print(f"\n🧹 Step 2: Creating focused intent-based query...")
            cleaned_query = self.clean_query_for_embedding(user_input, search_criteria)
            print(f"🎯 Focused Refined Query: '{cleaned_query}'")
            
            # Step 3: Search through embeddings with priority-based filtering
            print(f"\n🔍 Step 3: Searching with PRIMARY keyword filtering + CONTEXT ranking...")
            matching_chunks = self.search_chunks(search_criteria, user_input, cleaned_query)
            
            # Step 4: Format results with timing, summaries, and refined query
            print(f"\n📋 Step 4: Formatting results with timing and AI summaries...")
            all_results = self.format_results(matching_chunks, search_criteria, user_input, cleaned_query)
        
        # Step 5: Remove duplicates
        print(f"\n🔄 Step 5: Removing duplicates...")
        deduplicated_results = self.deduplicate_results(all_results)
        print(f"📊 Results after deduplication: {len(all_results)} → {len(deduplicated_results)}")
        
        return deduplicated_results

def main():
    """Main function"""
    searcher = SmartVideoSearch()
    
    if len(sys.argv) > 1:
        # Single search mode
        user_input = " ".join(sys.argv[1:])
        results = searcher.search(user_input)
        
        print(f"\n🎬 SEARCH RESULTS:")
        print("=" * 50)
        print(json.dumps(results, indent=2))
        
    else:
        # Interactive mode
        print("\n🎯 Interactive Video Search Mode")
        print("=" * 50)
        print("Enter queries to search for videos")
        print("Type 'quit' or 'exit' to stop")
        print("=" * 50)
        print("\n💡 Examples:")
        print("  • 'Give me top 20 video of me driving car on racing track'")
        print("  • 'top 5 cycling videos in mountains'")
        print("  • 'skiing downhill fast'")
        
        while True:
            try:
                user_input = input("\n📝 Enter your search: ").strip()
                
                if user_input.lower() in ['quit', 'exit', 'q']:
                    print("👋 Goodbye!")
                    break
                
                if not user_input:
                    print("⚠️ Please enter a search query")
                    continue
                
                results = searcher.search(user_input)
                
                print(f"\n🎬 SEARCH RESULTS:")
                print("=" * 50)
                print(json.dumps(results, indent=2))
                
            except KeyboardInterrupt:
                print("\n\n👋 Goodbye!")
                break
            except Exception as e:
                print(f"❌ Error: {e}")

if __name__ == "__main__":
    main() 