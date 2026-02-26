/*
  # Create Game History, Player Profiles, Friends, and Leaderboard Tables

  1. New Tables
    - `player_profiles` - Extended user information (bio, avatar, etc.)
    - `game_history` - Record of every game played
    - `player_stats` - Aggregated stats for leaderboards
    - `friend_requests` - Friend request system
    - `friends` - Confirmed friendships
    - `leaderboard_weekly` - Weekly leaderboard snapshots

  2. Security
    - Enable RLS on all tables
    - Add policies for user data access
    - Ensure users can only see appropriate data

  3. Important Notes
    - Game history tracks every match result
    - Stats are aggregated from history
    - Weekly leaderboard resets every Monday
    - Friends system allows private rooms
*/

-- Create player_profiles table
CREATE TABLE IF NOT EXISTS player_profiles (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio text DEFAULT '',
  avatar_url text,
  wins_total integer DEFAULT 0,
  losses_total integer DEFAULT 0,
  games_played integer DEFAULT 0,
  highest_score integer DEFAULT 0,
  total_words_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create game_history table
CREATE TABLE IF NOT EXISTS game_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  final_position integer,
  words_used text[] DEFAULT '{}',
  highest_word_value integer DEFAULT 0,
  game_duration integer,
  played_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create player_stats table for quick leaderboard queries
CREATE TABLE IF NOT EXISTS player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  games_played integer DEFAULT 0,
  total_score integer DEFAULT 0,
  average_score numeric DEFAULT 0,
  win_rate numeric DEFAULT 0,
  highest_score integer DEFAULT 0,
  total_words_used integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create friend_requests table
CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  requested_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_request CHECK (sender_id != receiver_id),
  CONSTRAINT unique_pending_request UNIQUE (sender_id, receiver_id)
);

-- Create friends table
CREATE TABLE IF NOT EXISTS friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_2 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friends_since timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_friend CHECK (user_id_1 != user_id_2),
  CONSTRAINT unique_friendship UNIQUE (user_id_1, user_id_2)
);

-- Create leaderboard_weekly table
CREATE TABLE IF NOT EXISTS leaderboard_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_starting date NOT NULL,
  wins integer DEFAULT 0,
  games_played integer DEFAULT 0,
  total_score integer DEFAULT 0,
  rank integer,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_weekly_user UNIQUE (user_id, week_starting)
);

-- Enable RLS on all new tables
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_weekly ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_profiles
CREATE POLICY "Users can view all profiles"
  ON player_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON player_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "New profile created on signup"
  ON player_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for game_history
CREATE POLICY "Users can view own game history"
  ON game_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view friend game history"
  ON game_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM friends
      WHERE (friends.user_id_1 = auth.uid() AND friends.user_id_2 = user_id)
         OR (friends.user_id_2 = auth.uid() AND friends.user_id_1 = user_id)
    )
  );

CREATE POLICY "Insert game history"
  ON game_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for player_stats
CREATE POLICY "Everyone can view player stats"
  ON player_stats FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for friend_requests
CREATE POLICY "Users can view own friend requests"
  ON friend_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send friend requests"
  ON friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update friend requests"
  ON friend_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- RLS Policies for friends
CREATE POLICY "Users can view their friends"
  ON friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2);

-- RLS Policies for leaderboard_weekly
CREATE POLICY "Everyone can view weekly leaderboard"
  ON leaderboard_weekly FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_game_history_user_id ON game_history(user_id);
CREATE INDEX idx_game_history_played_at ON game_history(played_at);
CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX idx_friends_user_id_1 ON friends(user_id_1);
CREATE INDEX idx_friends_user_id_2 ON friends(user_id_2);
CREATE INDEX idx_leaderboard_weekly_week ON leaderboard_weekly(week_starting);
CREATE INDEX idx_player_stats_user_id ON player_stats(user_id);
