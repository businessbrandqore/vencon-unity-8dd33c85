import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, Trash2, Settings, SmilePlus, Shield, Hash, Lock, Unlock, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const DEFAULT_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏", "💯", "🙏", "😍", "🤔", "👀", "✅", "❌"];

const HRChatAdmin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [newEmoji, setNewEmoji] = useState("");

  // Fetch groups with participants
  const { data: groups } = useQuery({
    queryKey: ["chat-groups-admin"],
    queryFn: async () => {
      const { data: convos } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("type", "group")
        .order("created_at", { ascending: false });

      if (!convos?.length) return [];

      const convoIds = convos.map((c) => c.id);
      const { data: parts } = await supabase
        .from("chat_participants")
        .select("conversation_id, user_id, is_admin")
        .in("conversation_id", convoIds);

      const userIds = [...new Set((parts || []).map((p) => p.user_id))];
      const { data: usersData } = await supabase.from("users").select("id, name, role").in("id", userIds);
      const nameMap = new Map((usersData || []).map((u) => [u.id, u]));

      return convos.map((c) => {
        const members = (parts || []).filter((p) => p.conversation_id === c.id);
        return {
          ...c,
          is_muted: (c as any).is_muted || false,
          members: members.map((m) => ({
            ...m,
            name: nameMap.get(m.user_id)?.name || "Unknown",
            role: nameMap.get(m.user_id)?.role || "",
          })),
        };
      });
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ["all-users-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, role, panel")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Fetch emoji config
  const { data: emojiConfig, refetch: refetchEmojis } = useQuery({
    queryKey: ["chat-reaction-emojis-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "chat_reaction_emojis")
        .maybeSingle();
      return (data?.value as string[]) || DEFAULT_EMOJIS.slice(0, 6);
    },
  });

  const createGroup = async () => {
    if (!groupName.trim() || !user) {
      toast.error("Group name required");
      return;
    }

    const { data: convo, error } = await supabase
      .from("chat_conversations")
      .insert({ name: groupName.trim(), type: "group", created_by: user.id })
      .select()
      .single();

    if (error || !convo) {
      toast.error("Failed to create group");
      return;
    }

    const members = [...new Set([user.id, ...selectedMembers])];
    await supabase.from("chat_participants").insert(
      members.map((uid) => ({
        conversation_id: convo.id,
        user_id: uid,
        is_admin: uid === user.id || selectedAdmins.includes(uid),
      }))
    );

    toast.success("Group created!");
    setGroupName("");
    setSelectedMembers([]);
    setSelectedAdmins([]);
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ["chat-groups-admin"] });
  };

  const toggleMute = async (groupId: string, currentMuted: boolean) => {
    await supabase
      .from("chat_conversations")
      .update({ is_muted: !currentMuted } as any)
      .eq("id", groupId);
    queryClient.invalidateQueries({ queryKey: ["chat-groups-admin"] });
    toast.success(!currentMuted ? "Group muted" : "Group unmuted");
  };

  const deleteGroup = async () => {
    if (!deleteGroupId) return;
    await supabase.from("chat_conversations").delete().eq("id", deleteGroupId);
    queryClient.invalidateQueries({ queryKey: ["chat-groups-admin"] });
    setDeleteGroupId(null);
    toast.success("Group deleted");
  };

  const toggleAdmin = async (groupId: string, userId: string, isAdmin: boolean) => {
    await supabase
      .from("chat_participants")
      .update({ is_admin: !isAdmin })
      .eq("conversation_id", groupId)
      .eq("user_id", userId);
    queryClient.invalidateQueries({ queryKey: ["chat-groups-admin"] });
    toast.success(!isAdmin ? "Admin role added" : "Admin role removed");
  };

  const removeMember = async (groupId: string, userId: string) => {
    await supabase
      .from("chat_participants")
      .delete()
      .eq("conversation_id", groupId)
      .eq("user_id", userId);
    queryClient.invalidateQueries({ queryKey: ["chat-groups-admin"] });
    toast.success("Member removed");
  };

  const addMemberToGroup = async (groupId: string, userId: string) => {
    await supabase.from("chat_participants").insert({
      conversation_id: groupId,
      user_id: userId,
      is_admin: false,
    });
    queryClient.invalidateQueries({ queryKey: ["chat-groups-admin"] });
    toast.success("Member added");
  };

  const saveEmojis = async (emojis: string[]) => {
    await supabase
      .from("app_settings")
      .upsert({ key: "chat_reaction_emojis", value: emojis as any, updated_by: user?.id }, { onConflict: "key" });
    refetchEmojis();
    toast.success("Emojis updated");
  };

  const addEmoji = () => {
    if (!newEmoji.trim() || !emojiConfig) return;
    const updated = [...emojiConfig, newEmoji.trim()];
    saveEmojis(updated);
    setNewEmoji("");
  };

  const removeEmoji = (emoji: string) => {
    if (!emojiConfig) return;
    saveEmojis(emojiConfig.filter((e) => e !== emoji));
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAdminSelection = (userId: string) => {
    setSelectedAdmins((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chat Admin</h1>
          <p className="text-muted-foreground text-sm">Group management & settings</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups"><Users className="h-3.5 w-3.5 mr-1.5" /> Groups</TabsTrigger>
          <TabsTrigger value="emojis"><SmilePlus className="h-3.5 w-3.5 mr-1.5" /> Reactions</TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-4">
          {/* Create Group Form */}
          {showCreate && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create Group Chat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Group Name</label>
                  <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Select Members ({selectedMembers.length} selected)
                  </label>
                  <ScrollArea className="h-48 border rounded mt-1">
                    {allUsers?.map((u) => (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-secondary cursor-pointer">
                        <Checkbox checked={selectedMembers.includes(u.id)} onCheckedChange={() => toggleMember(u.id)} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground">{u.role.replace(/_/g, " ")} • {u.panel}</p>
                        </div>
                        {selectedMembers.includes(u.id) && (
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Checkbox
                              checked={selectedAdmins.includes(u.id)}
                              onCheckedChange={() => toggleAdminSelection(u.id)}
                              className="h-3 w-3"
                            />
                            Admin
                          </label>
                        )}
                      </label>
                    ))}
                  </ScrollArea>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  <Button onClick={createGroup}>Create Group</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Groups list */}
          {groups?.map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">{g.name}</CardTitle>
                    {g.is_muted && (
                      <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-500/30">
                        <Lock className="h-3 w-3 mr-0.5" /> Muted
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleMute(g.id, g.is_muted)}
                    >
                      {g.is_muted ? <Unlock className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                      {g.is_muted ? "Unmute" : "Mute"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingGroup(editingGroup === g.id ? null : g.id)}
                    >
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      Manage
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteGroupId(g.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">{g.members.length} members</p>

                {editingGroup === g.id && (
                  <div className="space-y-3">
                    {/* Current members */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Member</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs">Admin</TableHead>
                          <TableHead className="text-xs w-20">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.members.map((m) => (
                          <TableRow key={m.user_id}>
                            <TableCell className="text-sm font-medium">{m.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.role.replace(/_/g, " ")}</TableCell>
                            <TableCell>
                              <Switch
                                checked={m.is_admin || false}
                                onCheckedChange={() => toggleAdmin(g.id, m.user_id, m.is_admin || false)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-destructive hover:text-destructive"
                                onClick={() => removeMember(g.id, m.user_id)}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Add member */}
                    <div>
                      <p className="text-xs font-medium mb-1">Add Member</p>
                      <ScrollArea className="h-32 border rounded">
                        {allUsers
                          ?.filter((u) => !g.members.some((m) => m.user_id === u.id))
                          .map((u) => (
                            <button
                              key={u.id}
                              onClick={() => addMemberToGroup(g.id, u.id)}
                              className="w-full text-left px-3 py-1.5 hover:bg-secondary flex items-center gap-2 text-sm"
                            >
                              <UserPlus className="h-3 w-3 text-primary" />
                              {u.name}
                              <span className="text-[10px] text-muted-foreground ml-auto">{u.role.replace(/_/g, " ")}</span>
                            </button>
                          ))}
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {!groups?.length && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No groups created yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="emojis">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <SmilePlus className="h-5 w-5" />
                Allowed Reaction Emojis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Chat-এ যেসব emoji দিয়ে react করা যাবে তা এখান থেকে নির্ধারণ করুন
              </p>

              {/* Current emojis */}
              <div className="flex flex-wrap gap-2">
                {emojiConfig?.map((emoji) => (
                  <div
                    key={emoji}
                    className="flex items-center gap-1 bg-secondary rounded-lg px-3 py-2 border border-border"
                  >
                    <span className="text-xl">{emoji}</span>
                    <button
                      onClick={() => removeEmoji(emoji)}
                      className="text-destructive hover:text-destructive/80 ml-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add emoji */}
              <div className="flex gap-2">
                <Input
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  placeholder="Emoji paste করুন..."
                  className="w-40"
                />
                <Button onClick={addEmoji} disabled={!newEmoji.trim()}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>

              {/* Quick add from defaults */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Quick Add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_EMOJIS.filter((e) => !emojiConfig?.includes(e)).map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        if (emojiConfig) saveEmojis([...emojiConfig, emoji]);
                      }}
                      className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-secondary"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteGroupId}
        onOpenChange={(open) => !open && setDeleteGroupId(null)}
        title="Delete Group"
        description="এই গ্রুপ এবং সব messages permanently delete হয়ে যাবে।"
        onConfirm={deleteGroup}
        variant="destructive"
      />
    </div>
  );
};

export default HRChatAdmin;
