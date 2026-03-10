import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

const HRChatAdmin = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const { data: groups } = useQuery({
    queryKey: ["chat-groups-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("type", "group")
        .order("created_at", { ascending: false });
      return data || [];
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

    // Add members + creator
    const members = [...new Set([user.id, ...selectedMembers])];
    await supabase.from("chat_participants").insert(
      members.map((uid) => ({
        conversation_id: convo.id,
        user_id: uid,
        is_admin: uid === user.id,
      }))
    );

    toast.success("Group created!");
    setGroupName("");
    setSelectedMembers([]);
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ["chat-groups-admin"] });
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chat Admin</h1>
          <p className="text-muted-foreground text-sm">Group chat management</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {/* Create Group Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Create Group Chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Select Members ({selectedMembers.length} selected)
              </label>
              <ScrollArea className="h-48 border rounded mt-1">
                {allUsers?.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-secondary cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMembers.includes(u.id)}
                      onCheckedChange={() => toggleMember(u.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {u.role.replace(/_/g, " ")} • {u.panel}
                      </p>
                    </div>
                  </label>
                ))}</ScrollArea>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button onClick={createGroup}>Create Group</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Groups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups?.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {g.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(g.created_at!).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {!groups?.length && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No groups created yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default HRChatAdmin;
