import { supabase } from './db.ts';

export async function saveGameResult(
  userId: string,
  roomId: string,
  score: number,
  finalPosition: number | undefined,
  wordsUsed: string[],
  highestWordValue: number,
  gameDuration: number
) {
  try {
    const { data, error } = await supabase
      .from('game_history')
      .insert([
        {
          user_id: userId,
          room_id: roomId,
          score,
          final_position: finalPosition,
          words_used: wordsUsed,
          highest_word_value: highestWordValue,
          game_duration: gameDuration,
          played_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Error saving game result:', error);
      return null;
    }

    await updatePlayerStats(userId);

    return data?.[0];
  } catch (err) {
    console.error('Exception saving game result:', err);
    return null;
  }
}

export async function updatePlayerStats(userId: string) {
  try {
    const { data: history, error: historyError } = await supabase
      .from('game_history')
      .select('score, final_position')
      .eq('user_id', userId);

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return;
    }

    const wins = history?.filter(g => g.final_position === 1).length || 0;
    const gamesPlayed = history?.length || 0;
    const totalScore = history?.reduce((sum, g) => sum + g.score, 0) || 0;
    const averageScore = gamesPlayed > 0 ? totalScore / gamesPlayed : 0;
    const winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
    const highestScore = Math.max(...(history?.map(g => g.score) || [0]));

    const { data: profile, error: profileError } = await supabase
      .from('player_profiles')
      .select('total_words_used')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) console.error('Error fetching profile:', profileError);

    const { error: updateError } = await supabase
      .from('player_stats')
      .upsert([
        {
          user_id: userId,
          wins,
          losses: Math.max(0, gamesPlayed - wins),
          games_played: gamesPlayed,
          total_score: totalScore,
          average_score: Number(averageScore.toFixed(2)),
          win_rate: Number(winRate.toFixed(2)),
          highest_score: highestScore,
          total_words_used: profile?.total_words_used || 0,
          last_updated: new Date().toISOString(),
        },
      ]);

    if (updateError) console.error('Error updating stats:', updateError);
  } catch (err) {
    console.error('Exception updating stats:', err);
  }
}

export async function getPlayerStats(userId: string) {
  try {
    const { data, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching player stats:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception fetching player stats:', err);
    return null;
  }
}

export async function getGlobalLeaderboard(limit: number = 50) {
  try {
    const { data, error } = await supabase
      .from('player_stats')
      .select('user_id, wins, games_played, total_score, average_score, win_rate, highest_score')
      .order('wins', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching leaderboard:', err);
    return [];
  }
}

export async function getWeeklyLeaderboard(limit: number = 50) {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('leaderboard_weekly')
      .select('user_id, wins, games_played, total_score, rank')
      .eq('week_starting', weekStart.toISOString().split('T')[0])
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching weekly leaderboard:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching weekly leaderboard:', err);
    return [];
  }
}

export async function sendFriendRequest(senderId: string, receiverUsername: string) {
  try {
    const { data: receiver, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', receiverUsername)
      .maybeSingle();

    if (userError || !receiver) {
      return { ok: false, error: 'User not found' };
    }

    const receiverId = receiver.id;

    if (senderId === receiverId) {
      return { ok: false, error: 'Cannot send friend request to yourself' };
    }

    const { data, error } = await supabase
      .from('friend_requests')
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          status: 'pending',
        },
      ])
      .select();

    if (error) {
      console.error('Error sending friend request:', error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: data?.[0] };
  } catch (err) {
    console.error('Exception sending friend request:', err);
    return { ok: false, error: 'Failed to send friend request' };
  }
}

export async function respondToFriendRequest(
  requestId: string,
  userId: string,
  accept: boolean
) {
  try {
    if (accept) {
      const { data: request, error: fetchError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('id', requestId)
        .maybeSingle();

      if (fetchError || !request) {
        return { ok: false, error: 'Request not found' };
      }

      const { data: updateData, error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', requestId)
        .select();

      if (updateError) {
        return { ok: false, error: updateError.message };
      }

      const { error: friendError } = await supabase
        .from('friends')
        .insert([
          {
            user_id_1: request.sender_id,
            user_id_2: request.receiver_id,
            friends_since: new Date().toISOString(),
          },
        ]);

      if (friendError) {
        return { ok: false, error: friendError.message };
      }

      return { ok: true, data: updateData?.[0] };
    } else {
      const { data, error } = await supabase
        .from('friend_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', requestId)
        .select();

      if (error) {
        return { ok: false, error: error.message };
      }

      return { ok: true, data: data?.[0] };
    }
  } catch (err) {
    console.error('Exception responding to friend request:', err);
    return { ok: false, error: 'Failed to respond to friend request' };
  }
}

export async function getFriendsList(userId: string) {
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('user_id_1, user_id_2')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (error) {
      console.error('Error fetching friends:', error);
      return [];
    }

    const friendIds = data?.map(f => (f.user_id_1 === userId ? f.user_id_2 : f.user_id_1)) || [];
    return friendIds;
  } catch (err) {
    console.error('Exception fetching friends:', err);
    return [];
  }
}

export async function getPendingFriendRequests(userId: string) {
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, status')
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending requests:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching pending requests:', err);
    return [];
  }
}

export async function getPlayerProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception fetching profile:', err);
    return null;
  }
}

export async function updatePlayerProfile(userId: string, updates: Record<string, any>) {
  try {
    const { data, error } = await supabase
      .from('player_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Error updating profile:', error);
      return null;
    }

    return data?.[0];
  } catch (err) {
    console.error('Exception updating profile:', err);
    return null;
  }
}
