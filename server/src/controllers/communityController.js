import { addComment, deleteOwnComment, listComments } from "../services/commentService.js";
import { flagContent } from "../services/flagService.js";
import { listQueue, moderate } from "../services/moderationService.js";
import { createPost, deleteOwnPost, getPost, listFeed } from "../services/postService.js";

const ctx = (req) => ({ ip: req.ip, requestId: req.id });

export const feed = async (req, res) => res.json(await listFeed(req.user, req.valid.query));
export const post = async (req, res) => res.json(await getPost(req.user, req.valid.params.id));
export const removePost = async (req, res) =>
  res.json(await deleteOwnPost(req.user, req.valid.params.id));
export const comments = async (req, res) =>
  res.json(await listComments(req.user, req.valid.params.id, req.valid.query));
export const removeComment = async (req, res) =>
  res.json(await deleteOwnComment(req.user, req.valid.params.id));
export const flag = async (req, res) => res.json(await flagContent(req.user, req.valid.body));
export const queue = async (req, res) => res.json(await listQueue(req.user, req.valid.query));

export async function newPost(req, res) {
  res.status(201).json(await createPost(req.user, req.valid.body));
}

export async function newComment(req, res) {
  res.status(201).json(await addComment(req.user, req.valid.params.id, req.valid.body));
}

export async function act(req, res) {
  const { type, id } = req.valid.params;
  res.json(await moderate(req.user, type, id, req.valid.body, ctx(req)));
}
